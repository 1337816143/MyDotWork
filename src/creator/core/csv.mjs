import {fail,validateMetric,metricIdentity,canonical} from './core.mjs';
export const CSV_COLUMNS=['publicationId','accountId','metricKey','value','unit','definition','observedAt','sourceRef','importRowId'];
function parseCsv(text) {
  if(typeof text!=='string'||text.length>4*1024*1024) fail('CSV_SIZE','CSV 必须是小于 4 MiB 的文本');
  const rows=[];let row=[],field='',quoted=false,afterQuote=false;
  text=text.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++) {
    const char=text[i];
    if(quoted) { if(char==='"') { if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;afterQuote=true;} } else field+=char; continue; }
    if(char==='"') {if(field||afterQuote)fail('CSV_PARSE','引号位置无效',{row:rows.length+1});quoted=true;continue;}
    if(char===','){row.push(field);field='';afterQuote=false;continue;}
    if(char==='\r'||char==='\n'){if(char==='\r'&&text[i+1]==='\n')i++;row.push(field);rows.push(row);row=[];field='';afterQuote=false;continue;}
    if(afterQuote)fail('CSV_PARSE','结束引号后出现多余字符',{row:rows.length+1});field+=char;
  }
  if(quoted)fail('CSV_PARSE','CSV 引号未闭合',{row:rows.length+1});
  if(field||row.length||afterQuote){row.push(field);rows.push(row);}
  return rows;
}
export function previewMetricsCsv(state,text,{mapping={}}={}) {
  const rows=parseCsv(text),columns=rows.shift()||[],errors=[],duplicates=[],snapshots=[];
  if(!columns.length) return {columns,errors:[{row:1,message:'CSV 为空'}],duplicates,snapshots,valid:false};
  if(new Set(columns).size!==columns.length) return {columns,errors:[{row:1,message:'CSV 表头重复'}],duplicates,snapshots,valid:false};
  // Mapping is {targetField: sourceHeader}; only metric fields are permitted.
  if(Object.keys(mapping).some(k=>!CSV_COLUMNS.includes(k)))fail('CSV_MAPPING','列映射只能包含指标字段');
  const lookup=Object.fromEntries(CSV_COLUMNS.map(key=>[key,columns.indexOf(mapping[key]||key)]));
  const mappedColumns=new Set(CSV_COLUMNS.map(key=>mapping[key]||key));
  for(const column of columns)if(!mappedColumns.has(column))errors.push({row:1,column,message:'不支持此列；CSV 不能修改作品、稿件或发布状态'});
  for(const required of ['metricKey','value','observedAt'])if(lookup[required]===-1)errors.push({row:1,column:required,message:'缺少必需列'});
  if(lookup.publicationId===-1&&lookup.accountId===-1)errors.push({row:1,message:'至少需要 publicationId 或 accountId 列'});
  if(rows.length>10000)fail('CSV_SIZE','CSV 超过 10000 行');
  const identities=new Map(Object.values(state.metrics).map(m=>[metricIdentity(m),m]));
  for(let i=0;i<rows.length;i++) {
    const values=rows[i];if(values.every(v=>!v.trim()))continue;
    try {
      if(values.length!==columns.length)fail('CSV_ROW','行列数与表头不符');
      const input={}; for(const key of CSV_COLUMNS)if(lookup[key]>=0)input[key]=values[lookup[key]];
      const raw=input.value??'';
      if(raw.trim()==='')input.value=null;
      else if(!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(raw.trim()))fail('CSV_VALUE','指标值只能为非负数，留空表示未知');
      else input.value=Number(raw);
      const metric=validateMetric(state,input),identity=metricIdentity(metric),prior=identities.get(identity);
      if(prior) {if(prior.value!==metric.value)fail('METRIC_CONFLICT','同一采样时刻已有不同指标值');duplicates.push({row:i+2,metricId:prior.id||null,identity});continue;}
      if(metric.importRowId) {const old=[...identities.values()].find(m=>m.importRowId===metric.importRowId);if(old&&canonical(old)!==canonical(metric))fail('METRIC_CONFLICT','导入行标识已用于其他指标');}
      identities.set(identity,metric);snapshots.push(metric);
    } catch(error) {errors.push({row:i+2,code:error.code||'CSV_ROW',message:error.message});}
  }
  return {columns,errors,duplicates,snapshots,valid:errors.length===0};
}
function cell(value) {
  let text=value==null?'':String(value);
  if(/^[\s]*[=+\-@]/.test(text)||/^[\t\r\n]/.test(text))text=`'${text}`;
  return `"${text.replaceAll('"','""')}"`;
}
export function exportMetricsCsv(state) {
  return [CSV_COLUMNS.map(cell).join(','),...Object.values(state.metrics).map(m=>CSV_COLUMNS.map(k=>cell(m[k])).join(','))].join('\r\n')+'\r\n';
}
