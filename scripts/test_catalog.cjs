const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const C=require('../src/catalog.js'),root=path.resolve(__dirname,'..');
const d=JSON.parse(fs.readFileSync(path.join(root,'dist/dashboard/catalog.json'),'utf8'));
assert.equal(d.records.length,d.counts.artifacts+d.counts.websites+d.counts.tasks);
assert.equal(new Set(d.records.map(r=>r.id)).size,d.records.length);
assert(d.records.every(r=>r.metadataApproved===true&&r.access==='public'));
const reports=C.filter(d.records,{task:'project-1',type:'report',access:'public',q:'第二轮',from:'2026-10-02',to:'2026-10-02'},d.tasks);
assert.deepEqual(reports.map(r=>r.id),['upstream-round2']);
assert.equal(C.filter(d.records,{q:'no-match-987654'},d.tasks).length,0);
assert.equal(C.filter(d.records,{access:'login'},d.tasks).length,0);
assert.equal(C.filter(d.records,{},d.tasks).length,d.records.length);
const sites=d.records.filter(r=>['mydotwork-workbench','evolution-mirror'].includes(r.id));
const datedSites=d.records.filter(r=>['paper-learning-site','farm-system-site'].includes(r.id));
assert.equal(datedSites.length,2);assert(datedSites.every(r=>Number.isFinite(Date.parse(r.updatedAt))));
const datedFixture=datedSites.map(r=>({...r,updatedAt:'2026-10-03T17:00:00Z'}));
assert.equal(C.filter(datedFixture,{from:'2026-10-03',to:'2026-10-03'},d.tasks).length,2);
assert.equal(C.filter(datedFixture,{to:'2026-10-02'},d.tasks).length,0);
assert(sites.every(r=>r.updatedAt===null));
assert.equal(C.filter(sites,{from:'2026-10-01'},d.tasks).length,0,'Unknown dates are excluded by date filters');
assert(C.filter(d.records,{sort:'latest'},d.tasks).slice(-sites.length).every(r=>r.updatedAt===null));
assert(C.filter(d.records,{sort:'oldest'},d.tasks).slice(-sites.length).every(r=>r.updatedAt===null));
assert.equal(C.filter([{...reports[0],metadataApproved:false}],{},d.tasks).length,0);
assert.equal(C.filter([{...reports[0],access:'private'}],{},d.tasks).length,0);
assert.deepEqual(C.filter(d.records,{q:'上游 JSON',type:'dataset'},d.tasks).map(r=>r.id).sort(),['gpt-source-followup-r11-evidence-20261103','gpt-source-followup-r12-evidence-20261103','gpt-source-followup-r140-20261111-evidence','gpt-source-followup-r159-20261112-evidence','gpt-source-followup-r162-20261113-evidence','gpt-source-followup-r164-20261113-evidence','gpt-source-followup-r165-20261113-evidence','gpt-source-followup-r168-20261113-evidence','gpt-source-followup-r169-20261113-evidence','gpt-source-followup-r17-20261104-evidence','gpt-source-followup-r174-20261114-evidence','gpt-source-followup-r176-20261114-evidence','gpt-source-followup-r177-20261114-evidence','gpt-source-followup-r181-20261114-evidence','gpt-source-followup-r185-20261114-evidence','gpt-source-followup-r193-20261115-evidence','gpt-source-followup-r194-20261115-evidence','gpt-source-followup-r2-evidence-20261103','gpt-source-followup-r20-20261104-evidence','gpt-source-followup-r207-20261115-evidence','gpt-source-followup-r210-20261115-evidence','gpt-source-followup-r211-20261116-evidence','gpt-source-followup-r212-20261116-evidence','gpt-source-followup-r216-20261116-evidence','gpt-source-followup-r218-20261116-evidence','gpt-source-followup-r219-20261117-evidence','gpt-source-followup-r221-20261117-evidence','gpt-source-followup-r222-20261117-evidence','gpt-source-followup-r225-20261117-evidence','gpt-source-followup-r226-20261117-evidence','gpt-source-followup-r227-20261117-evidence','gpt-source-followup-r228-20261117-evidence','gpt-source-followup-r230-20261118-evidence','gpt-source-followup-r231-20261118-evidence','gpt-source-followup-r232-20261118-evidence','gpt-source-followup-r233-20261118-evidence','gpt-source-followup-r235-20261118-evidence','gpt-source-followup-r237-20261118-evidence','gpt-source-followup-r238-20261119-evidence','gpt-source-followup-r239-20261119-evidence','gpt-source-followup-r240-20261119-evidence','gpt-source-followup-r241-20261119-evidence','gpt-source-followup-r244-20261119-evidence','gpt-source-followup-r245-20261119-evidence','gpt-source-followup-r247-20261120-evidence','gpt-source-followup-r249-20261120-evidence','gpt-source-followup-r250-20261120-evidence','gpt-source-followup-r251-20261120-evidence','gpt-source-followup-r252-20261120-evidence','gpt-source-followup-r256-20261120-evidence','gpt-source-followup-r257-20261120-evidence','gpt-source-followup-r259-20261120-evidence','gpt-source-followup-r260-20261121-evidence','gpt-source-followup-r261-20261121-evidence','gpt-source-followup-r262-20261121-evidence','gpt-source-followup-r263-20261121-evidence','gpt-source-followup-r264-20261121-evidence','gpt-source-followup-r265-20261121-evidence','gpt-source-followup-r267-20261121-evidence','gpt-source-followup-r268-20261121-evidence','gpt-source-followup-r270-20261122-evidence','gpt-source-followup-r271-20261122-evidence','gpt-source-followup-r272-20261122-evidence','gpt-source-followup-r274-20261122-evidence','gpt-source-followup-r275-20261123-evidence','gpt-source-followup-r277-20261123-evidence','gpt-source-followup-r28-20261104-evidence','gpt-source-followup-r29-20261104-evidence','gpt-source-followup-r3-evidence-20261103','gpt-source-followup-r32-20261104-evidence','gpt-source-followup-r37-20261104-evidence','gpt-source-followup-r6-evidence-20261103','gpt-source-followup-r69-20261106-evidence','gpt-source-followup-r7-evidence-20261103','gpt-source-followup-r76-20261106-evidence','gpt-source-followup-r78-20261107-evidence','gpt-source-followup-r81-20261107-evidence','gpt-source-followup-r82-20261107-evidence','round1-data','round2-data','upstream-round3-7-data'],'Search uses approved project titles with AND terms');
assert.deepEqual(C.filter(d.records,{task:'project-17',type:'report'},d.tasks).map(r=>r.id),['business-validation-20261004','task35-evidence-gates-20261003','side-income-report'],'Side-income report has its own project, not the agricultural project');
assert.equal(C.stamp(null),null);assert.equal(C.stamp('unknown'),null);
const w32=d.records.find(r=>r.id==='gpt-source-followup-r32-20261104');
const w32data=d.records.find(r=>r.id==='gpt-source-followup-r32-20261104-evidence');
assert(w32&&w32data&&w32.url.endsWith('supplier-followup-20261104-r18.html'));
const current=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-04/supplier-followup-20261104-r18-evidence.json'),'utf8'));
assert.equal(current.round,32);assert.equal(current.candidates[0].public_component_sum_cny,149.99);
assert.equal(current.candidates[0].all_in_cny,null);assert.equal(current.independent_phone_verification.tested_success_count,0);
const r33=d.records.find(r=>r.id==='gpt-source-followup-r33-20261104');
const r33data=d.records.find(r=>r.id==='gpt-source-followup-r33-20261104-evidence');
assert(r33&&r33data&&r33.url.endsWith('supplier-followup-20261104-r19.html'));
const supplement=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-04/supplier-followup-20261104-r19-evidence.json'),'utf8'));
assert.equal(supplement.round,33);assert.equal(supplement.qualification_totals.new_independent_suppliers_added,0);
assert.equal(supplement.existing_agent_terms_not_newly_changed.required_agent_entry_fee_cny,3000);
assert.equal(supplement.new_distinction.claimed_not_api,true);
const r35cat=d.records.find(r=>r.id==='gpt-source-followup-r35-20261104');
const r35data=d.records.find(r=>r.id==='gpt-source-followup-r35-20261104-evidence');
assert(r35cat&&r35data&&r35cat.url.endsWith('supplier-followup-20261104-r21.html'));
const r35check=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-04/supplier-followup-20261104-r21-evidence.json'),'utf8'));
assert.equal(r35check.round,35);assert.equal(r35check.service_status.backend_outage_confirmed,false);
assert.equal(r35check.service_status.actual_paid_plus_cny,null);assert.equal(r35check.phone_verification.verified_success_count,0);
const r36cat=d.records.find(r=>r.id==='gpt-source-followup-r36-20261104');
const r36data=d.records.find(r=>r.id==='gpt-source-followup-r36-20261104-evidence');
assert(r36cat&&r36data&&r36cat.url.endsWith('supplier-followup-20261104-r22.html'));
const r36=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-04/supplier-followup-20261104-r22-evidence.json'),'utf8'));
assert.equal(r36.round,36);assert.equal(r36.new_invoice_evidence.site_explicit_no_china_vat_invoice,true);
assert.equal(r36.new_invoice_evidence.total_plus_invoice_included_cny,null);
assert.equal(r36.phone_verification.success_tests,0);assert.equal(r36.qualification_totals.new_verified_plus_wholesale_upstreams,0);
const r37cat=d.records.find(r=>r.id==='gpt-source-followup-r37-20261104');
const r37data=d.records.find(r=>r.id==='gpt-source-followup-r37-20261104-evidence');
assert(r37cat&&r37data&&r37cat.url.endsWith('supplier-followup-20261104-r23.html'));
const r37=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-04/supplier-followup-20261104-r23-evidence.json'),'utf8'));
assert.equal(r37.round,37);assert.equal(r37.new_candidates[0].real_paid_invoice_included_cny,null);
assert.equal(r37.new_candidates[1].payment_subtotal_preview_cny,149.78);
assert.equal(r37.qualification_totals.new_verified_plus_wholesale_upstreams,0);
const r38cat=d.records.find(r=>r.id==='gpt-source-followup-r38-20261104');
const r38data=d.records.find(r=>r.id==='gpt-source-followup-r38-20261104-evidence');
assert(r38cat&&r38data&&r38cat.url.endsWith('supplier-followup-20261104-r24.html'));
const r38=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-04/supplier-followup-20261104-r24-evidence.json'),'utf8'));
assert.equal(r38.round,38);assert.equal(r38.changes[0].coupon_and_first_purchase_task_stack,false);
assert.equal(r38.changes[0].offer_end_local,'2026-11-11T23:59:00+08:00');
assert(r38.changes[1].seller_remedy_options.includes('更换全新官方账号'));
assert.equal(r38.changes[0].real_all_required_fees_invoice_included_cny,null);
assert.equal(r38.qualification_totals.new_verified_plus_wholesale_upstreams,0);
const r39cat=d.records.find(r=>r.id==='gpt-source-followup-r39-20261105');
const r39data=d.records.find(r=>r.id==='gpt-source-followup-r39-20261105-evidence');
assert(r39cat&&r39data&&r39cat.url.endsWith('supplier-followup-20261105.html'));
const r39=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-05/supplier-followup-20261105-evidence.json'),'utf8'));
assert.equal(r39.round,39);assert.equal(r39.new_candidates[0].public_component_sum_cny,153);
assert.equal(r39.new_candidates[0].real_paid_invoice_included_cny,null);
assert.equal(r39.official_phone_verification.voip_supported,false);
assert.equal(r39.qualification_totals.new_verified_plus_wholesale_upstreams,0);
const r40cat=d.records.find(r=>r.id==='gpt-source-followup-r40-20261105');
const r40data=d.records.find(r=>r.id==='gpt-source-followup-r40-20261105-evidence');
assert(r40cat&&r40data&&r40cat.url.endsWith('supplier-followup-20261105-r2.html'));
const r40=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-05/supplier-followup-20261105-r2-evidence.json'),'utf8'));
assert.equal(r40.round,40);assert.equal(r40.independent_phone_services[0].display_price_cny_per_one_time,15);
assert.equal(r40.independent_phone_services[0].scanned_payment_refund_to_original_payment_method_claim,false);
assert.equal(r40.independent_phone_services[2].real_payable_sku_confirmed,false);
assert.equal(r40.independent_phone_services[2].number_held_for_30_or_60_days,false);
assert.equal(r40.qualification_totals.new_verified_plus_wholesale_upstreams,0);
const r41cat=d.records.find(r=>r.id==='gpt-source-followup-r41-20261105');
const r41data=d.records.find(r=>r.id==='gpt-source-followup-r41-20261105-evidence');
assert(r41cat&&r41data&&r41cat.url.endsWith('supplier-followup-20261105-r3.html'));
const r41=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-05/supplier-followup-20261105-r3-evidence.json'),'utf8'));
assert.equal(r41.round,41);assert.equal(r41.new_candidates.length,5);
assert.equal(r41.new_candidates[2].display_price_cny,168);
assert.equal(r41.new_candidates[2].real_paid_invoice_included_cny,null);
assert.equal(r41.new_candidates[4].calculated_wechat_amount_cny,148.52);
assert.equal(r41.new_candidates[4].unauthorized_resale_prohibited_by_terms,true);
assert.equal(r41.qualification_totals.new_verified_plus_wholesale_upstreams,0);
const r42cat=d.records.find(r=>r.id==='gpt-source-followup-r42-20261105'),r42data=d.records.find(r=>r.id==='gpt-source-followup-r42-20261105-evidence');
assert(r42cat&&r42data&&r42cat.url.endsWith('supplier-followup-20261105-r4.html'));
const r42=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-05/supplier-followup-20261105-r4-evidence.json'),'utf8'));
assert.equal(r42.round,42);assert.equal(r42.sources.length,8);
assert.equal(r42.new_candidates[0].public_component_sum_cny,155.4);
assert.equal(r42.new_candidates[0].real_paid_invoice_included_cny,null);
assert.equal(r42.new_candidates[0].session_shared_with_partner_fulfillment_claim,true);
assert.equal(r42.independent_phone_services[0].post_payment_refund_supported_claim,false);
assert.equal(r42.independent_phone_services[0].number_session_window_minutes_claim,20);
assert.equal(r42.qualification_totals.new_verified_plus_wholesale_upstreams,0);
const r43cat=d.records.find(r=>r.id==='gpt-source-followup-r43-20261105'),r43data=d.records.find(r=>r.id==='gpt-source-followup-r43-20261105-evidence');
assert(r43cat&&r43data&&r43cat.url.endsWith('supplier-followup-20261105-r5.html'));
const r43=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-05/supplier-followup-20261105-r5-evidence.json'),'utf8'));
assert.equal(r43.round,43);assert.equal(r43.current_plus.display_price_cny,155);
assert.equal(r43.current_plus.real_paid_invoice_included_cny,null);
assert.equal(r43.independent_phone_service.display_price_cny_per_one_time,12);
assert.equal(r43.qualification_totals.new_verified_plus_wholesale_upstreams,0);
const r44cat=d.records.find(r=>r.id==='gpt-source-followup-r44-20261105'),r44data=d.records.find(r=>r.id==='gpt-source-followup-r44-20261105-evidence');
assert(r44cat&&r44data&&r44cat.url.endsWith('supplier-followup-20261105-r6.html'));
const r44=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-05/supplier-followup-20261105-r6-evidence.json'),'utf8'));
assert.equal(r44.round,44);assert.equal(r44.sources.length,7);
assert.equal(r44.new_candidate.display_price_cny,128.8);assert.equal(r44.new_candidate.china_vat_invoice_available_at_displayed_sku,false);
assert.equal(r44.new_candidate.payment_fee_cny,null);assert.equal(r44.new_candidate.real_paid_invoice_included_cny,null);
assert.equal(r44.bounded_recheck.individual_order_china_tax_invoice_supported_claim,false);
assert.equal(r44.qualification_totals.verified_plus_wholesale_upstreams,0);
const r45cat=d.records.find(r=>r.id==='gpt-source-followup-r45-20261105'),r45data=d.records.find(r=>r.id==='gpt-source-followup-r45-20261105-evidence');
assert(r45cat&&r45data&&r45cat.url.endsWith('supplier-followup-20261105-r7.html'));
const r45=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-05/supplier-followup-20261105-r7-evidence.json'),'utf8'));
assert.equal(r45.round,45);assert.equal(r45.new_candidate.display_price_cny,139);
assert.equal(r45.new_candidate.invoice_fee_rate_claim,.03);assert.equal(r45.new_candidate.public_known_components_sum_cny,143.17);
assert.equal(r45.new_candidate.real_paid_all_fees_including_invoice_cny,null);assert.equal(r45.new_candidate.payment_fee_cny,null);
assert.equal(r45.new_candidate.formal_wholesale_or_resale_authorization_verified,false);
assert.equal(r45.sources.filter(s=>s.read_status==='success_read').length,7);
assert.equal(r45.qualification_totals.verified_plus_wholesale_upstreams,0);
const r46cat=d.records.find(r=>r.id==='gpt-source-followup-r46-20261105'),r46data=d.records.find(r=>r.id==='gpt-source-followup-r46-20261105-evidence');
assert(r46cat&&r46data&&r46cat.url.endsWith('supplier-followup-20261105-r8.html'));
const r46=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-05/supplier-followup-20261105-r8-evidence.json'),'utf8'));
assert.equal(r46.round,46);assert.equal(r46.site_version,'1.9.54');
assert.equal(r46.material_observation.account_skus[0].historical_display_price_cny,115);
assert.equal(r46.material_observation.account_skus[0].current_display_price_cny,113);
assert.equal(r46.material_observation.account_skus[0].period_months_verified_on_current_page,null);
assert.equal(r46.material_observation.account_skus[1].historical_display_price_cny,130);
assert.equal(r46.material_observation.account_skus[1].current_display_price_cny,129);
assert.equal(r46.additional_bounded_sources.independent_codex_sms.display_price_cny_per_single_cdk,3);
assert.equal(r46.additional_bounded_sources.new_retail_candidate_checkout_test_mode.real_money_checkout_confirmed,false);
assert.equal(r46.material_observation.account_skus[1].all_required_fees_including_china_invoice_cny,null);
assert.equal(r46.qualification_totals.verified_plus_wholesale_upstreams,0);
const r47cat=d.records.find(r=>r.id==='gpt-source-followup-r47-20261105'),r47data=d.records.find(r=>r.id==='gpt-source-followup-r47-20261105-evidence');
assert(r47cat&&r47data&&r47cat.url.endsWith('supplier-followup-20261105-r9.html'));
const r47=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-05/supplier-followup-20261105-r9-evidence.json'),'utf8'));
assert.equal(r47.round,47);assert.equal(r47.site_version,'1.9.55');assert.equal(r47.sources.length,9);
assert.equal(r47.new_supplier_candidates[0].display_price_cny,107);
assert.equal(r47.new_supplier_candidates[0].all_required_fees_including_china_invoice_cny,null);
assert.equal(r47.independent_phone_services[0].display_price_cny_per_one_time_cdk,3);
assert.equal(r47.independent_phone_services[0].login_password_requested_by_third_party_claim,true);
assert.equal(r47.independent_phone_services[0].failed_sms_refund_to_original_payment_verified,null);
assert.equal(r47.new_supplier_candidates[1].top_agent_discount_usd,0);
assert.deepEqual(r47.other_supplier_route_excluded.public_agent_program_upfront_cny,[399,1980,3980]);
assert.equal(r47.qualification_totals.verified_plus_wholesale_upstreams,0);
const r48cat=d.records.find(r=>r.id==='gpt-source-followup-r48-20261105'),r48data=d.records.find(r=>r.id==='gpt-source-followup-r48-20261105-evidence');
assert(r48cat&&r48data&&r48cat.url.endsWith('supplier-followup-20261105-r10.html'));
const r48=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-05/supplier-followup-20261105-r10-evidence.json'),'utf8'));
assert.equal(r48.round,48);assert.equal(r48.site_version,'1.9.56');assert.equal(r48.sources.length,6);
assert.equal(r48.new_retail_sku.display_price,24.99);assert.equal(r48.new_retail_sku.currency,'USD');assert.equal(r48.new_retail_sku.period_months_verified,null);
assert.equal(r48.new_upstream_candidate.costs.points_per_success,10);assert.equal(r48.new_upstream_candidate.costs.all_in_invoice_cny,null);
assert.equal(r48.new_upstream_candidate.marketing_demo.example_wallet_price_is_verified_live_sku,false);
assert.equal(r48.api_distinction.sms_verification_service_discovered,false);
assert.equal(r48.qualification_totals.verified_plus_wholesale_upstreams,0);
const r49cat=d.records.find(r=>r.id==='gpt-source-followup-r49-20261105'),r49data=d.records.find(r=>r.id==='gpt-source-followup-r49-20261105-evidence');
assert(r49cat&&r49data&&r49cat.url.endsWith('supplier-followup-20261105-r11.html'));
const r49=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-05/supplier-followup-20261105-r11-evidence.json'),'utf8'));
assert.equal(r49.round,49);assert.equal(r49.site_version,'1.9.57');assert.equal(r49.sources.length,9);
assert.equal(r49.newly_read_direct_merchant.plus.display_price,140);
assert.equal(r49.newly_read_direct_merchant.plus.all_required_fees_with_invoice_cny,null);
assert.equal(r49.newly_read_direct_merchant.sms.alipay_page_claimed_total_cny,18.36);
assert.equal(r49.newly_read_direct_merchant.sms.usable_for_chatgpt_web_claim,false);
assert.equal(r49.upstream_trace_secondary.plus.display_cny,112);
assert.equal(r49.upstream_trace_secondary.plus.actual_checkout_price_verified,false);
assert.equal(r49.upstream_trace_secondary.codex_sms.snapshot_date,'2026-11-02');
assert.equal(r49.upstream_trace_secondary.codex_sms.same_batch_or_wholesale_chain_verified,false);
assert.equal(r49.separate_other_candidate.own_account,false);
assert.equal(r49.qualification_totals.verified_plus_wholesale_upstreams,0);
const r50cat=d.records.find(r=>r.id==='gpt-source-followup-r50-20261105'),r50data=d.records.find(r=>r.id==='gpt-source-followup-r50-20261105-evidence');
assert(r50cat&&r50data&&r50cat.url.endsWith('supplier-followup-20261105-r12.html'));
const r50=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-05/supplier-followup-20261105-r12-evidence.json'),'utf8'));
assert.equal(r50.round,50);assert.equal(r50.site_version,'1.9.58');assert.equal(r50.sources.length,10);
assert.equal(r50.supplier_chain[0].forwards_session_to_third_party_claim,true);
assert.equal(r50.supplier_chain[0].full_invoice_included_cny,null);
assert.equal(r50.supplier_chain[1].terms_prohibit_resale_of_purchased_services,true);
assert.equal(r50.supplier_chain[2].public_essential_cost_component_sum_cny,178.08);
assert.equal(r50.independent_phone_services[1].starts_from_listing_not_purchase_claim,true);
assert.equal(r50.independent_phone_services[2].no_refunds_for_unreceivable_or_invalid_number_claim,true);
assert.equal(r50.qualification_totals.verified_plus_wholesale_upstreams,0);
const r51cat=d.records.find(r=>r.id==='gpt-source-followup-r51-20261105'),r51data=d.records.find(r=>r.id==='gpt-source-followup-r51-20261105-evidence');
assert(r51cat&&r51data&&r51cat.url.endsWith('supplier-followup-20261105-r13.html'));
const r51=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-05/supplier-followup-20261105-r13-evidence.json'),'utf8'));
assert.equal(r51.round,51);assert.equal(r51.site_version,'1.9.59');assert.equal(r51.sources.length,8);
assert.equal(r51.new_retail_supplier.alipay_wechat_display_cny_per_month,138);
assert.equal(r51.new_retail_supplier.usdt_discounted_display_cny_per_month,133);
assert.equal(r51.new_retail_supplier.real_all_required_fees_including_china_invoice_cny,null);
assert.equal(r51.new_retail_supplier.external_redemption_flow_session_or_token_requirements_verified,null);
assert.equal(r51.reseller_claims_and_terms.partner_program_is_referral_not_verified_wholesale,true);
assert.equal(r51.upstream_infrastructure_traces[1].public_verified_wholesale_price_cny,null);
assert.equal(r51.qualification_totals.verified_plus_wholesale_upstreams,0);
const r52cat=d.records.find(r=>r.id==='gpt-source-followup-r52-20261105'),r52data=d.records.find(r=>r.id==='gpt-source-followup-r52-20261105-evidence');
assert(r52cat&&r52data&&r52cat.url.endsWith('supplier-followup-20261105-r14.html'));
const r52=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-05/supplier-followup-20261105-r14-evidence.json'),'utf8'));
assert.equal(r52.round,52);assert.equal(r52.site_version,'1.9.60');assert.equal(r52.sources.length,9);
assert.equal(r52.new_retail_candidate.price_usdt_per_month,13.8);
assert.equal(r52.new_retail_candidate.own_existing_chatgpt_account_accepted_verified,null);
assert.equal(r52.new_retail_candidate.actual_cny_total_with_invoice,null);
assert.equal(r52.separate_apple_gift_card.face_value_usd,20);
assert.equal(r52.separate_apple_gift_card.merchant_display_price_usd_equivalent,14);
assert.equal(r52.separate_apple_gift_card.apple_resale_authorization_verified,false);
assert.equal(r52.official_openai_gift_card.apple_or_google_billed_subscription_not_eligible,true);
assert.equal(r52.prior_candidate_check.price_change_confirmed,false);
assert.equal(r52.qualification_totals.verified_plus_wholesale_upstreams,0);
const r53cat=d.records.find(r=>r.id==='gpt-source-followup-r53-20261105'),r53data=d.records.find(r=>r.id==='gpt-source-followup-r53-20261105-evidence');
assert(r53cat&&r53data&&r53cat.url.endsWith('supplier-followup-20261105-r15.html'));
const r53=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-05/supplier-followup-20261105-r15-evidence.json'),'utf8'));
assert.equal(r53.round,53);assert.equal(r53.site_version,'1.9.61');assert.equal(r53.sources.length,6);
assert.deepEqual(r53.public_reference_skus.map(x=>x.merchant_public_wholesale_reference_usdt_per_item),[15.5,15.8]);
assert.equal(r53.new_wholesale_interface_lead.final_invoiced_payment_cny,null);
assert.equal(r53.conflicts.separate_openapi_redeem_endpoint_requires_cardkey_and_accountsession,true);
assert.equal(r53.qualification_totals.verified_plus_wholesale_upstreams,0);
const r54cat=d.records.find(r=>r.id==='gpt-source-followup-r54-20261105'),r54data=d.records.find(r=>r.id==='gpt-source-followup-r54-20261105-evidence');
assert(r54cat&&r54data&&r54cat.url.endsWith('supplier-followup-20261105-r16.html'));
const r54=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-05/supplier-followup-20261105-r16-evidence.json'),'utf8'));
assert.equal(r54.round,54);assert.equal(r54.site_version,'1.9.62');assert.equal(r54.sources.length,6);
assert.equal(r54.corporate_lead.price_cny_per_seat_month,165);
assert.equal(r54.corporate_lead.real_paid_all_in_cny,null);
assert.equal(r54.corporate_lead.invoice_sample_is_issued_verified,false);
assert.equal(r54.v3_retail_skus[0].reported_inventory,'无货');
assert.equal(r54.v3_retail_skus[0].stock_change_proven,false);
assert.equal(r54.qualification_totals.verified_plus_wholesale_upstreams,0);
const r55cat=d.records.find(r=>r.id==='gpt-source-followup-r55-20261105'),r55data=d.records.find(r=>r.id==='gpt-source-followup-r55-20261105-evidence');
assert(r55cat&&r55data&&r55cat.url.endsWith('supplier-followup-20261105-r17.html'));
const r55=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-05/supplier-followup-20261105-r17-evidence.json'),'utf8'));
assert.equal(r55.round,55);assert.equal(r55.site_version,'1.9.63');assert.equal(r55.sources.length,7);
assert.equal(r55.candidate.one_piece_list_price_cny,115);
assert.equal(r55.candidate.one_month_subscription_term_explicitly_verified,null);
assert.equal(r55.candidate.actual_all_in_cny,null);
assert.equal(r55.api.ordinary_buyer_purchase_api,true);
assert.equal(r55.api.independently_verified_old_api_http_410,false);
assert.equal(r55.api.order_token_is_not_phone_number_lifetime,true);
assert.equal(r55.qualification_totals.verified_plus_wholesale_upstreams,0);
const r56cat=d.records.find(r=>r.id==='gpt-source-followup-r56-20261106'),r56data=d.records.find(r=>r.id==='gpt-source-followup-r56-20261106-evidence');
assert(r56cat&&r56data&&r56cat.url.endsWith('supplier-followup-20261106-r01.html'));
const r56=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-06/supplier-followup-20261106-r01-evidence.json'),'utf8'));
assert.equal(r56.round,56);assert.equal(r56.site_version,'1.9.64');assert.equal(r56.sources.length,11);
assert.equal(r56.v3_inventory_delta.current_stock_label,'一般');
assert.equal(r56.v3_inventory_delta.actual_checkout_availability_tested,false);
assert.equal(r56.v3_inventory_delta.real_all_in_cny,null);
assert.equal(r56.sms_service_new_unverified.refund_to_original_payment_verified,false);
assert.equal(r56.qualification_totals.verified_plus_wholesale_upstreams,0);
const r57cat=d.records.find(v=>v.id==='gpt-source-followup-r57-20261106');
const r57data=d.records.find(v=>v.id==='gpt-source-followup-r57-20261106-evidence');
assert(r57cat&&r57data);
const r57=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-06/supplier-followup-20261106-r02-evidence.json'),'utf8'));
assert.equal(r57.round,57);assert.equal(r57.site_version,'1.9.65');assert.equal(r57.sources.length,6);
assert.equal(r57.new_retail_candidate_unverified.known_advertised_components_sum_cny,153);
assert.equal(r57.new_retail_candidate_unverified.real_all_in_cny,null);
assert.equal(r57.new_retail_candidate_unverified.formal_resale_authorization_verified,false);
assert.equal(r57.qualification_totals.verified_plus_wholesale_upstreams,0);
const r58cat=d.records.find(v=>v.id==='gpt-source-followup-r58-20261106'),r58data=d.records.find(v=>v.id==='gpt-source-followup-r58-20261106-evidence');
assert(r58cat&&r58data);
const r58=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-06/supplier-followup-20261106-r03-evidence.json'),'utf8'));
assert.equal(r58.round,58);assert.equal(r58.site_version,'1.9.66');assert.equal(r58.sources.length,11);
assert.equal(r58.new_sms_service.openai_exact_sku_current_price,null);
assert.equal(r58.new_sms_service.company_registration_cross_checked,true);
assert.equal(r58.new_sms_service.codex_desktop_phone_success_tested,false);
assert.equal(r58.qualification_totals.verified_plus_wholesale_upstreams,0);
const r59cat=d.records.find(v=>v.id==='gpt-source-followup-r59-20261106'),r59data=d.records.find(v=>v.id==='gpt-source-followup-r59-20261106-evidence');
assert(r59cat&&r59data);
const r59=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-06/supplier-followup-20261106-r04-evidence.json'),'utf8'));
assert.equal(r59.round,59);assert.equal(r59.site_version,'1.9.67');assert.equal(r59.sources.length,11);
assert.equal(r59.new_independent_phone_service.listed_price_cny_per_one_time_code,9.99);
assert.equal(r59.new_independent_phone_service.real_payment_total_cny,null);
assert.equal(r59.new_independent_phone_service.refund_after_payment_supported_by_faq,false);
assert.equal(r59.new_independent_phone_service.codex_desktop_success_tested,false);
assert.equal(r59.qualification_totals.verified_plus_wholesale_upstreams,0);
const r60cat=d.records.find(v=>v.id==='gpt-source-followup-r60-20261106'),r60data=d.records.find(v=>v.id==='gpt-source-followup-r60-20261106-evidence');
assert(r60cat&&r60data);assert(r60cat.url.endsWith('supplier-followup-20261106-r05.html'));
const r60=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-06/supplier-followup-20261106-r05-evidence.json'),'utf8'));
assert.equal(r60.round,60);assert.equal(r60.site_version,'1.9.68');assert.equal(r60.sources.length,12);
assert.equal(r60.new_phone_verification_candidate.listed_price_cny_per_one_codex_verification_cdk,3);
assert.equal(r60.new_phone_verification_candidate.chatgpt_account_password_may_be_required,true);
assert.equal(r60.new_phone_verification_candidate.authenticator_mfa_code_may_be_required,true);
assert.equal(r60.new_phone_verification_candidate.codex_desktop_phone_success_tested,false);
assert.equal(r60.new_phone_verification_candidate.refund_to_original_payment_if_sms_fails_verified,false);
assert.equal(r60.new_retail_plus_candidate_unverified.price_cny_per_piece_per_month,107);
assert.equal(r60.new_retail_plus_candidate_unverified.real_invoiced_all_in_cny,null);
assert.equal(r60.new_retail_plus_candidate_unverified.wholesale_authorization_independently_verified,false);
assert.equal(r60.qualification_totals.verified_plus_wholesale_upstreams,0);
const r66cat=d.records.find(v=>v.id==='gpt-source-followup-r66-20261106'),r66data=d.records.find(v=>v.id==='gpt-source-followup-r66-20261106-evidence');
assert(r66cat&&r66data);assert(r66cat.url.endsWith('supplier-followup-20261106-r11.html'));
const r66=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-06/supplier-followup-20261106-r11-evidence.json'),'utf8'));
assert.equal(r66.round,66);assert.equal(r66.site_version,'1.9.74');assert.equal(r66.sources.filter(x=>x.read_status==='readable').length,6);
assert.equal(r66.new_candidate.advertised_price_usd_per_card,16);
assert.equal(r66.new_candidate.claimed_supreme_agent_price_usd_per_card,16);
assert.equal(r66.new_candidate.verified_invoice_including_payment_all_in_cny,null);
assert.equal(r66.new_candidate.faq_admits_simulated_queue_count,true);
assert.equal(r66.new_candidate.wholesale_qualified,false);
assert.equal(r66.qualification_totals.verified_plus_wholesale_upstreams,0);
const r67cat=d.records.find(v=>v.id==='gpt-source-followup-r67-20261106'),r67data=d.records.find(v=>v.id==='gpt-source-followup-r67-20261106-evidence');
assert(r67cat&&r67data);assert(r67cat.url.endsWith('supplier-followup-20261106-r12.html'));
const r67=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-06/supplier-followup-20261106-r12-evidence.json'),'utf8'));
assert.equal(r67.round,67);assert.equal(r67.site_version,'1.9.75');assert.equal(r67.sources.filter(x=>x.read_status==='readable').length,7);
assert.equal(r67.new_retail_plus_candidate_unverified.displayed_price_cny_per_account_month,168);
assert.equal(r67.new_retail_plus_candidate_unverified.conditional_price_plus_five_percent_invoice_cny,176.4);
assert.equal(r67.new_retail_plus_candidate_unverified.plus_sku_invoice_eligibility_verified,false);
assert.equal(r67.new_retail_plus_candidate_unverified.actual_total_payment_with_china_vat_invoice_cny,null);
assert.equal(r67.independent_phone_verification.displayed_price_cny_per_number,35);
assert.equal(r67.independent_phone_verification.merchant_terms_allow_number_replacement,false);
assert.equal(r67.independent_phone_verification.merchant_terms_allow_self_service_refund,false);
assert.equal(r67.partner_promotion_historical_claim.promotion_current_checkout_price_verified,false);
assert.equal(r67.qualification_totals.verified_plus_wholesale_upstreams,0);
const r69cat=d.records.find(x=>x.id==='gpt-source-followup-r69-20261106');assert(r69cat&&r69cat.url.endsWith('supplier-followup-20261106-r14.html'));
const r69=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-06/supplier-followup-20261106-r14-evidence.json'),'utf8'));
assert.equal(r69.round,69);assert.equal(r69.new_candidate_unverified.displayed_price,14.93);assert.equal(r69.new_candidate_unverified.all_required_costs_including_china_vat_cny,null);
assert.equal(r69.prior_candidate_material_clarification.asks_to_paste_entire_account_info_page,true);
const r70cat=d.records.find(x=>x.id==='gpt-source-followup-r70-20261106');assert(r70cat&&r70cat.url.endsWith('supplier-followup-20261106-r15.html'));
const r70=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-06/supplier-followup-20261106-r15-evidence.json'),'utf8'));
assert.equal(r70.round,70);assert.equal(r70.site_version,'1.9.78');assert.equal(r70.sources.length,8);
assert.equal(r70.new_candidate.sku_code,'55E12C278B07774A');
assert.equal(r70.new_candidate.merchant_published_wholesale_cny,112);
assert.equal(r70.new_candidate.mandatory_reusable_wallet_topup_cny,500);
assert.equal(r70.new_candidate.actual_all_in_cny_for_one_account_month,null);
assert.equal(r70.qualification_totals.verified_plus_wholesale_upstreams,0);

const r71cat=d.records.find(x=>x.id==='gpt-source-followup-r71-20261106');
const r71data=d.records.find(x=>x.id==='gpt-source-followup-r71-20261106-evidence');
assert(r71cat&&r71data&&r71cat.url.endsWith('supplier-followup-20261106-r16.html'));
const r71=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-06/supplier-followup-20261106-r16-evidence.json'),'utf8'));
assert.equal(r71.round,71);assert.equal(r71.site_version,'1.9.79');assert.equal(r71.sources.length,10);
assert.equal(r71.new_candidate.retail_price_cny_per_account_month,149);
assert.equal(r71.new_candidate.agent_discounts_are_illustrative,true);
assert.equal(r71.new_candidate.illustrative_bronze_price_cny,141.55);
assert.equal(r71.new_candidate.actual_one_piece_wholesale_cny,null);
assert.equal(r71.new_candidate.actual_one_account_month_invoiced_all_in_cny,null);
assert.equal(r71.new_candidate.enterprise_minimum_accounts,5);
assert.equal(r71.new_candidate.wholesale_qualified,false);
assert.equal(r71.independent_codex_phone_verification.display_price_cny_per_attempt,12);
assert.equal(r71.independent_codex_phone_verification.number_validity_days,null);
assert.equal(r71.independent_codex_phone_verification.sms_failure_original_refund_guaranteed,false);
assert.equal(r71.qualification_totals.verified_plus_wholesale_upstreams,0);
const r72cat=d.records.find(x=>x.id==='gpt-source-followup-r72-20261106');
const r72data=d.records.find(x=>x.id==='gpt-source-followup-r72-20261106-evidence');
assert(r72cat&&r72data&&r72cat.url.endsWith('supplier-followup-20261106-r17.html'));
const r72=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-06/supplier-followup-20261106-r17-evidence.json'),'utf8'));
assert.equal(r72.round,72);assert.equal(r72.site_version,'1.9.80');assert.equal(r72.sources.length,6);
assert.equal(r72.new_operator_clarification.verified_legal_operating_entity,null);
assert.equal(r72.single_piece_invoice.invoice_fee_cny,null);
assert.equal(r72.conditional_promotion.new_coupon_code,'888888');
assert.equal(r72.conditional_promotion.conditional_retention_math_cny,126);
assert.equal(r72.conditional_promotion.real_checkout_coupon_redeemed_verified,false);
assert.equal(r72.conditional_promotion.mandatory_reusable_wallet_predeposit_cny,500);
assert.equal(r72.qualification_totals.verified_plus_wholesale_upstreams,0);
console.log('PASS: catalogue counts, explicit public metadata, task/type/access/date/search combinations, reset/empty, unknown-date sorting and no unapproved records');

const r73cat=d.records.find(r=>r.id==='gpt-source-followup-r73-20261106'),r73data=d.records.find(r=>r.id==='gpt-source-followup-r73-20261106-evidence');
assert(r73cat&&r73data&&r73cat.url.endsWith('supplier-followup-20261106-r18.html'));
const r73=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-06/supplier-followup-20261106-r18-evidence.json'),'utf8'));
assert.equal(r73.round,73);assert.equal(r73.site_version,'1.9.81');assert.equal(r73.sources.length,8);
assert.equal(r73.new_retail_candidate.sku_id,'pid=23');assert.equal(r73.new_retail_candidate.advertised_base_price_cny,169);
assert.equal(r73.new_retail_candidate.advertised_invoice_inclusive_price_cny,179);
assert.equal(r73.new_retail_candidate.exact_sku_subscription_months_explicitly_verified,null);
assert.equal(r73.new_retail_candidate.actual_order_total_invoiced_cny,null);
assert.equal(r73.new_retail_candidate.fully_qualified_upstream,false);
assert.equal(r73.new_supply_chain_observation.merchant_says_non_firsthand_suppliers_may_cooperate,true);
assert.equal(r73.qualification_totals.verified_plus_wholesale_upstreams,0);

const r74cat=d.records.find(r=>r.id==='gpt-source-followup-r74-20261106'),r74data=d.records.find(r=>r.id==='gpt-source-followup-r74-20261106-evidence');
assert(r74cat&&r74data&&r74cat.url.endsWith('supplier-followup-20261106-r19.html'));
const r74=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-06/supplier-followup-20261106-r19-evidence.json'),'utf8'));
assert.equal(r74.round,74);assert.equal(r74.site_version,'1.9.82');assert.equal(r74.sources.length,7);
assert.equal(r74.material_change.historical_visible_availability,'暂时缺货');assert.equal(r74.material_change.new_visible_availability,'现货 · 自动发货');
assert.equal(r74.material_change.advertised_price_changed,false);assert.equal(r74.material_change.actual_invoiced_total_cny,null);
assert.equal(r74.new_retail_wholesale_advertising_candidate.merchant_promoted_agent_entry_fee_cny,99);
assert.equal(r74.new_retail_wholesale_advertising_candidate.merchant_explicitly_declines_mainland_china_users,true);
assert.equal(r74.new_retail_wholesale_advertising_candidate.wholesale_qualified,false);
assert.equal(r74.qualification_totals.verified_plus_wholesale_upstreams,0);

const r75cat=d.records.find(r=>r.id==='gpt-source-followup-r75-20261106'),r75data=d.records.find(r=>r.id==='gpt-source-followup-r75-20261106-evidence');
assert(r75cat&&r75data&&r75cat.url.endsWith('supplier-followup-20261106-r20.html'));
const r75=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-06/supplier-followup-20261106-r20-evidence.json'),'utf8'));
assert.equal(r75.round,75);assert.equal(r75.site_version,'1.9.83');assert.equal(r75.sources.length,7);
assert.equal(r75.material_price_observation.previous_recorded_price_cny,115);assert.equal(r75.material_price_observation.current_public_price_cny,113);
assert.equal(r75.material_price_observation.all_required_invoiced_cny,null);
assert.equal(r75.independent_phone_verification.public_price_cny,3);assert.equal(r75.independent_phone_verification.real_openai_verification_passed,false);
assert.equal(r75.qualification_totals.verified_plus_wholesale_upstreams,0);

const r76cat=d.records.find(r=>r.id==='gpt-source-followup-r76-20261106'),r76data=d.records.find(r=>r.id==='gpt-source-followup-r76-20261106-evidence');
assert(r76cat&&r76data&&r76cat.url.endsWith('supplier-followup-20261106-r21.html'));
const r76=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-06/supplier-followup-20261106-r21-evidence.json'),'utf8'));
assert.equal(r76.round,76);assert.equal(r76.site_version,'1.9.84');assert.equal(r76.sources.length,8);
assert.equal(r76.new_retail_candidate.public_base_price_cny_per_account_month,143);
assert.equal(r76.new_retail_candidate.public_china_vat_invoice_surcharge_cny,10);
assert.equal(r76.new_retail_candidate.conditional_displayed_components_total_cny,153);
assert.equal(r76.new_retail_candidate.verified_actual_checkout_total_with_valid_china_vat_invoice_cny,null);
assert.equal(r76.new_retail_candidate.merchant_acknowledges_access_token_and_session_token,true);
assert.equal(r76.new_retail_candidate.wholesale_qualified,false);
assert.equal(r76.independent_phone_verification.auto_binds_phone,false);
assert.equal(r76.qualification_totals.verified_plus_wholesale_upstreams,0);

const r77cat=d.records.find(r=>r.id==='gpt-source-followup-r77-20261107');
const r77data=d.records.find(r=>r.id==='gpt-source-followup-r77-20261107-evidence');
assert(r77cat&&r77data&&r77cat.url.endsWith('supplier-followup-20261107.html'));
const r77=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-07/supplier-followup-20261107-evidence.json'),'utf8'));
assert.equal(r77.round,77);assert.equal(r77.site_version,'1.9.85');assert.equal(r77.sources.length,10);
assert.equal(r77.new_retail_lead_unverified.public_displayed_price_cny_per_30_day_card,125);
assert.equal(r77.new_retail_lead_unverified.wholesale_qualified,false);
assert.equal(r77.independent_phone_verification.conflicting_price_display,true);
assert.equal(r77.independent_phone_verification.actual_checkout_price_cny,null);
assert.equal(r77.qualification_totals.verified_plus_wholesale_upstreams,0);

const r78cat=d.records.find(r=>r.id==='gpt-source-followup-r78-20261107');
const r78data=d.records.find(r=>r.id==='gpt-source-followup-r78-20261107-evidence');
assert(r78cat&&r78data&&r78cat.url.endsWith('supplier-followup-20261107-r2.html'));
const r78=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-07/supplier-followup-20261107-r2-evidence.json'),'utf8'));
assert.equal(r78.round,78);assert.equal(r78.site_version,'1.9.86');assert.equal(r78.sources.length,4);
assert.equal(r78.material_policy_scope_discovery.explicit_warranty_only_for_marked_items,true);
assert(r78.material_policy_scope_discovery.original_account_skus.every(s=>s.warranty_mark_on_current_catalog===false&&s.displayed_price_cny_per_item===139));
assert.equal(r78.material_policy_scope_discovery.merchant_site_public_claims_conflict,true);
assert.equal(r78.material_policy_scope_discovery.warranty_entitlement_of_specific_paid_order_verified,null);
assert.equal(r78.qualification_totals.verified_plus_wholesale_upstreams,0);

const r79cat=d.records.find(r=>r.id==='gpt-source-followup-r79-20261107');
const r79data=d.records.find(r=>r.id==='gpt-source-followup-r79-20261107-evidence');
assert(r79cat&&r79data&&r79cat.url.endsWith('supplier-followup-20261107-r3.html'));
const r79=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-07/supplier-followup-20261107-r3-evidence.json'),'utf8'));
assert.equal(r79.round,79);assert.equal(r79.site_version,'1.9.87');assert.equal(r79.sources.length,12);
assert.equal(r79.material_phone_risk.historical_event_from,'2026-07-27');
assert.equal(r79.material_phone_risk.operator_terms_newly_changed_on_observation_date,false);
assert.equal(r79.material_phone_risk.first_person_giffgaff_termination_email_reported,'2026-07-28');
assert.equal(r79.material_phone_risk.phone_number_validity_guarantee_days,null);
assert.equal(r79.material_phone_risk.carrier_community_19_days_case_full_page_read,false);
assert.equal(r79.qualification_totals.verified_plus_wholesale_upstreams,0);

const r80cat=d.records.find(r=>r.id==='gpt-source-followup-r80-20261107');
const r80data=d.records.find(r=>r.id==='gpt-source-followup-r80-20261107-evidence');
assert(r80cat&&r80data&&r80cat.url.endsWith('supplier-followup-20261107-r4.html'));
const r80=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-07/supplier-followup-20261107-r4-evidence.json'),'utf8'));
assert.equal(r80.round,80);assert.equal(r80.site_version,'1.9.88');assert.equal(r80.sources.length,11);
assert.equal(r80.new_candidate.public_list_price_cny_per_account_month,129);
assert.equal(r80.new_candidate.conditional_returning_customer_discount_cny,5);
assert.equal(r80.new_candidate.company_vat_invoice_issuer_name,null);
assert.equal(r80.new_candidate.final_payable_all_in_china_vat_invoice_cny,null);
assert.equal(r80.new_candidate.merchant_claimed_personal_operator,true);
assert.equal(r80.new_candidate.merchant_claimed_personal_wechat_alipay_receiving_account,true);
assert.equal(r80.new_candidate.invoice_can_be_requested_merchant_claim,true);
assert.equal(r80.new_candidate.chatgpt_session_auth_information_required,true);
assert.equal(r80.new_candidate.wholesale_qualified,false);
assert.equal(r80.independent_phone_verification.ordinary_plus_purchase_automatically_binds_phone,false);
assert.equal(r80.qualification_totals.verified_plus_wholesale_upstreams,0);

const r82cat=d.records.find(r=>r.id==='gpt-source-followup-r82-20261107');
const r82e=d.records.find(r=>r.id==='gpt-source-followup-r82-20261107-evidence');
assert(r82cat&&r82e&&r82cat.url.endsWith('supplier-followup-20261107-r6.html'));
const r82=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-07/supplier-followup-20261107-r6-evidence.json'),'utf8'));
assert.equal(r82.round,82);assert.equal(r82.site_version,'1.9.90');assert.equal(r82.sources.length,4);
assert.equal(r82.material_discovery.merchant_public_online_price_cny,139.99);
assert.equal(r82.material_discovery.online_component_sum_cny,149.99);
assert.equal(r82.material_discovery.merchant_public_corporate_school_bank_transfer_price_cny,160);
assert.equal(r82.material_discovery.corporate_price_includes_einvoice,null);
assert.equal(r82.material_discovery.actual_paid_invoice_total_cny,null);
assert.equal(r82.material_discovery.guest_checkout_invoice_eligibility_verified,false);
assert.equal(r82.qualification_totals.verified_plus_wholesale_upstreams,0);

const r83cat=d.records.find(r=>r.id==='gpt-source-followup-r83-20261107');
const r83data=d.records.find(r=>r.id==='gpt-source-followup-r83-20261107-evidence');
assert(r83cat&&r83data&&r83cat.url.endsWith('supplier-followup-20261107-r7.html'));
const r83=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-07/supplier-followup-20261107-r7-evidence.json'),'utf8'));
assert.equal(r83.round,83);assert.equal(r83.site_version,'1.9.91');assert.equal(r83.sources.length,5);
assert.equal(r83.material_discoveries[0].previous_stock_label,'无货');
assert.equal(r83.material_discoveries[0].current_stock_label,'一般');
assert.equal(r83.material_discoveries[0].previous_list_price_cny,143.5);
assert.equal(r83.material_discoveries[0].current_list_price_cny,143.5);
assert.equal(r83.material_discoveries[0].real_paid_full_cost_cny,null);
assert.equal(r83.material_discoveries[0].same_original_account_preserved_after_failure_guaranteed,false);
assert.equal(r83.material_discoveries[1].current_stock_label,'暂时缺货');
assert.equal(r83.material_discoveries[1].actual_stock_status_change_proven,false);
assert.equal(r83.qualification_totals.verified_plus_wholesale_upstreams,0);

const r84cat=d.records.find(r=>r.id==='gpt-source-followup-r84-20261107');
const r84data=d.records.find(r=>r.id==='gpt-source-followup-r84-20261107-evidence');
assert(r84cat&&r84data&&r84cat.url.endsWith('supplier-followup-20261107-r8.html'));
const r84=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-07/supplier-followup-20261107-r8-evidence.json'),'utf8'));
assert.equal(r84.round,84);assert.equal(r84.site_version,'1.9.92');assert.equal(r84.sources.length,5);
assert.equal(r84.new_candidates[0].options[0].price_cny,119);assert.equal(r84.new_candidates[0].options[2].price_cny,130);
assert.equal(r84.new_candidates[0].checkout_warns_preorder_ship_after_restock,true);
assert.equal(r84.new_candidates[0].actual_all_in_china_vat_invoice_cny,null);
assert.equal(r84.new_candidates[1].requires_logged_in_session_json,true);
assert.equal(r84.new_candidates[1].actual_all_in_china_vat_invoice_cny,null);
assert.equal(r84.phone_verification.plus6_price_cny,null);
assert.equal(r84.qualification_totals.verified_plus_wholesale_upstreams,0);

const r87cat=d.records.find(r=>r.id==='gpt-source-followup-r87-20261107'),r87data=d.records.find(r=>r.id==='gpt-source-followup-r87-20261107-evidence');
assert(r87cat&&r87data&&r87cat.url.endsWith('supplier-followup-20261107-r11.html'));
const r87=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-07/supplier-followup-20261107-r11-evidence.json'),'utf8'));
assert.equal(r87.round,87);assert.equal(r87.site_version,'1.9.95');assert.equal(r87.sources.length,13);
assert.equal(r87.substantive_aftersales_clarification.mass_incident_refund_unconditionally_guaranteed,false);
assert.equal(r87.substantive_aftersales_clarification.real_all_in_vat_invoice_total_cny,null);
assert.equal(r87.independent_codex_verification.public_price_cny,12);
assert.equal(r87.independent_codex_verification.unable_to_receive_sms_refund_cny,null);
assert.equal(r87.qualification_totals.verified_plus_wholesale_upstreams,0);
const r86cat=d.records.find(r=>r.id==='gpt-source-followup-r86-20261107');
const r86data=d.records.find(r=>r.id==='gpt-source-followup-r86-20261107-evidence');
assert(r86cat&&r86data&&r86cat.url.endsWith('supplier-followup-20261107-r10.html'));
const r86=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-07/supplier-followup-20261107-r10-evidence.json'),'utf8'));
assert.equal(r86.round,86);assert.equal(r86.site_version,'1.9.94');assert.equal(r86.sources.length,7);
assert.equal(r86.material_correction.current_invoice_portal_accepting_applications,false);
assert.equal(r86.material_correction.invoice_member_login_required_before_purchase,true);
assert.equal(r86.material_correction.guest_order_invoice_access_claim,false);
assert.equal(r86.material_correction.known_component_sum_cny,149.99);
assert.equal(r86.material_correction.actual_total_including_any_other_payment_and_valid_china_vat_invoice_cny,null);
assert.equal(r86.qualification_totals.verified_plus_wholesale_upstreams,0);
const r85cat=d.records.find(r=>r.id==='gpt-source-followup-r85-20261107');
const r85data=d.records.find(r=>r.id==='gpt-source-followup-r85-20261107-evidence');
assert(r85cat&&r85data&&r85cat.url.endsWith('supplier-followup-20261107-r9.html'));
const r85=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-07/supplier-followup-20261107-r9-evidence.json'),'utf8'));
assert.equal(r85.round,85);assert.equal(r85.site_version,'1.9.93');assert.equal(r85.sources.length,7);
assert.equal(r85.new_candidates[0].listed_price,16);assert.equal(r85.new_candidates[0].currency,'USD');
assert.equal(r85.new_candidates[0].actual_agent_discount_usd_from_displayed_retail,0);
assert.equal(r85.new_candidates[0].subscription_months,null);
assert.equal(r85.new_candidates[0].actual_all_in_china_vat_invoice_cny,null);
assert.equal(r85.new_candidates[1].displayed_preorder_total_cny,149.78);
assert.equal(r85.new_candidates[1].tiers[3].commission_percent,25);
assert.equal(r85.new_candidates[1].wholesale_unit_cost_cny,null);
assert.equal(r85.phone_verification.independent_sms_service_verified,false);
assert.equal(r85.qualification_totals.verified_plus_wholesale_upstreams,0);

const r88cat=d.records.find(r=>r.id==='gpt-source-followup-r88-20261107'),r88data=d.records.find(r=>r.id==='gpt-source-followup-r88-20261107-evidence');
assert(r88cat&&r88data&&r88cat.url.endsWith('supplier-followup-20261107-r12.html'));
const r88=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-07/supplier-followup-20261107-r12-evidence.json'),'utf8'));
assert.equal(r88.round,88);assert.equal(r88.site_version,'1.9.96');assert.equal(r88.sources.length,8);
assert.equal(r88.material_new_candidate.displayed_retail_skus[0].public_list_price_cny,128);
assert.equal(r88.material_new_candidate.displayed_retail_skus[1].public_list_price_cny,148);
assert.equal(r88.material_new_candidate.enterprise_supply.merchant_claim_minimum_account_count,5);
assert.equal(r88.material_new_candidate.enterprise_supply.claimed_technical_service_fee_percent_for_enterprise_special_invoice,6);
assert.equal(r88.material_new_candidate.enterprise_supply.one_item_real_vat_invoice_total_cny,null);
assert.equal(r88.qualification_totals.verified_plus_wholesale_upstreams,0);

const r89cat=d.records.find(r=>r.id==='gpt-source-followup-r89-20261108');
const r89dataset=d.records.find(r=>r.id==='gpt-source-followup-r89-20261108-evidence');
assert(r89cat&&r89dataset&&r89cat.url.endsWith('supplier-followup-20261108.html'));
const r89=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-08/supplier-followup-20261108-evidence.json'),'utf8'));
assert.equal(r89.round,89);assert.equal(r89.site_version,'1.9.97');assert.equal(r89.sources.length,8);assert.equal(r89.existing_retail_candidate_recheck.previously_documented_in_round,76);assert.equal(r89.existing_retail_candidate_recheck.material_condition_change_found,false);
assert.equal(r89.existing_retail_candidate_recheck.price_cny,143);
assert.equal(r89.existing_retail_candidate_recheck.invoice_addon_cny,10);
assert.equal(r89.existing_retail_candidate_recheck.public_component_sum_cny,153);
assert.equal(r89.existing_retail_candidate_recheck.real_all_in_china_vat_invoice_total_cny,null);
assert.equal(r89.existing_retail_candidate_recheck.session_json_submitted_to_third_party_site_required,true);
assert.equal(r89.existing_retail_candidate_recheck.existing_member_days_auto_stack,false);
assert.equal(r89.independent_phone_verification.listed_price_cny_per_one_code,9.99);
assert.equal(r89.independent_phone_verification.max_free_number_swaps_merchant_claim,30);
assert.equal(r89.independent_phone_verification.failed_sms_cash_refund_guaranteed,false);
assert.equal(r89.independent_phone_verification.actual_sms_receive_tested,false);
assert.equal(r89.qualification_totals.verified_plus_wholesale_upstreams,0);

const r90cat=d.records.find(r=>r.id==='gpt-source-followup-r90-20261108');
const r90data=d.records.find(r=>r.id==='gpt-source-followup-r90-20261108-evidence');
assert(r90cat&&r90data&&r90cat.url.endsWith('supplier-followup-20261108-r2.html'));
const r90=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-08/supplier-followup-20261108-r2-evidence.json'),'utf8'));
assert.equal(r90.round,90);assert.equal(r90.site_version,'1.9.98');assert.equal(r90.sources.length,8);
assert.equal(r90.newly_documented_public_api.customer_supplies_payment_card,true);
assert.equal(r90.newly_documented_public_api.requires_existing_chatgpt_session,true);
assert.equal(r90.newly_documented_public_api.public_example_plus_price_credits,50);
assert.equal(r90.newly_documented_public_api.real_live_plus_price_credits,null);
assert.equal(r90.newly_documented_public_api.real_all_in_china_vat_invoice_total_cny,null);
assert.equal(r90.qualification_totals.verified_plus_wholesale_upstreams,0);

const r91cat=d.records.find(r=>r.id==='gpt-source-followup-r91-20261108');
const r91data=d.records.find(r=>r.id==='gpt-source-followup-r91-20261108-evidence');
assert(r91cat&&r91data&&r91cat.url.endsWith('supplier-followup-20261108-r3.html'));
const r91=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-08/supplier-followup-20261108-r3-evidence.json'),'utf8'));
assert.equal(r91.round,91);assert.equal(r91.site_version,'1.9.99');assert.equal(r91.sources.length,8);
assert.equal(r91.new_retail_intermediary.exact_public_skus[0].public_list_price_cny_per_package,145);
assert.equal(r91.new_retail_intermediary.exact_public_skus[1].public_list_price_cny_per_package,165);
assert.equal(r91.new_retail_intermediary.merchant_terms_prohibit_bulk_resale,true);
assert.equal(r91.new_retail_intermediary.exact_public_skus[0].actual_subscription_term_days,null);
assert.equal(r91.new_retail_intermediary.exact_public_skus[1].actual_china_vat_invoice_all_in_cny,null);
assert.equal(r91.excluded_example.real_plus_subscription_sku_verified,false);
assert.equal(r91.qualification_totals.verified_plus_wholesale_upstreams,0);

const r92cat=d.records.find(r=>r.id==='gpt-source-followup-r92-20261108');
const r92data=d.records.find(r=>r.id==='gpt-source-followup-r92-20261108-evidence');
assert(r92cat&&r92data&&r92cat.url.endsWith('supplier-followup-20261108-r4.html'));
const r92=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-08/supplier-followup-20261108-r4-evidence.json'),'utf8'));
assert.equal(r92.round,92);assert.equal(r92.site_version,'1.9.100');assert.equal(r92.sources.length,5);
assert.equal(r92.newly_documented_agent_program.program_public_upfront_service_price_cny,88);
assert.equal(r92.newly_documented_agent_program.program_is_upfront_fee_free,false);
assert.equal(r92.newly_documented_agent_program.public_price_plus_invoice_component_cny,93.28);
assert.equal(r92.newly_documented_agent_program.merchant_general_terms_prohibit_resale,true);
assert.equal(r92.newly_documented_agent_program.agent_advertises_customer_resale_and_own_pricing,true);
assert.equal(r92.newly_documented_agent_program.formal_merchant_resale_grant_document,null);
assert.equal(r92.newly_documented_agent_program.program_public_wholesale_plus_price_cny,null);
assert.deepEqual(r92.bounded_recheck_of_existing_retail_skus.map(s=>s.public_price_cny_per_account_month),[135,145]);
assert.equal(r92.bounded_recheck_of_existing_retail_skus[1].actual_all_required_payment_and_china_vat_invoice_cny,null);
assert.equal(r92.independent_phone_verification.successfully_received_sms_total,0);
assert.equal(r92.qualification_totals.verified_plus_wholesale_upstreams,0);

const r93cat=d.records.find(r=>r.id==='gpt-source-followup-r93-20261108');
const r93data=d.records.find(r=>r.id==='gpt-source-followup-r93-20261108-evidence');
assert(r93cat&&r93data&&r93cat.url.endsWith('supplier-followup-20261108-r5.html'));
const r93=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-08/supplier-followup-20261108-r5-evidence.json'),'utf8'));
assert.equal(r93.round,93);assert.equal(r93.site_version,'1.9.101');assert.equal(r93.sources.length,4);
assert.equal(r93.new_business_supplier_candidate.public_volume_discount_threshold_seats,10);
assert.equal(r93.new_business_supplier_candidate.public_strict_minimum_order_seats,null);
assert.equal(r93.new_business_supplier_candidate.public_bulk_unit_price_usd,null);
assert.equal(r93.new_business_supplier_candidate.china_vat_invoice_available,false);
assert.equal(r93.new_business_supplier_candidate.api_credit_refund_is_cash_refund,false);
assert.equal(r93.new_business_supplier_candidate.b2b_retail_resale_authorization_document,null);
assert.equal(r93.separate_public_retail_sku.public_display_price_number,23.9);
assert.equal(r93.separate_public_retail_sku.actual_all_required_fees_and_valid_china_vat_invoice_cny,null);
assert.equal(r93.phone_verification.verified_sms_successes,0);
assert.equal(r93.qualification_totals.verified_plus_wholesale_upstreams,0);

const r94cat=d.records.find(r=>r.id==='gpt-source-followup-r94-20261108');
const r94data=d.records.find(r=>r.id==='gpt-source-followup-r94-20261108-evidence');
assert(r94cat&&r94data&&r94cat.url.endsWith('supplier-followup-20261108-r6.html'));
const r94=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-08/supplier-followup-20261108-r6-evidence.json'),'utf8'));
assert.equal(r94.round,94);assert.equal(r94.site_version,'1.9.102');assert.equal(r94.sources.length,6);
assert.deepEqual(r94.conflicting_current_retail_sku.current_observations.map(s=>s.public_price_cny),[169,159,159]);
assert.equal(r94.conflicting_current_retail_sku.historical_direct_observation.public_price_cny,149);
assert.equal(r94.conflicting_current_retail_sku.verified_single_payable_retail_price_cny,null);
assert.equal(r94.conflicting_current_retail_sku.all_required_fees_including_valid_china_vat_invoice_cny,null);
assert.equal(r94.wholesale_and_invoice_bounded_recheck.real_one_item_wholesale_price_cny,null);
assert.equal(r94.wholesale_and_invoice_bounded_recheck.one_item_invoice_availability_verified,false);
assert.equal(r94.phone_verification.successful_sms_tests,0);
assert.equal(r94.qualification_totals.verified_plus_wholesale_upstreams,0);

const r95cat=d.records.find(x=>x.id==='gpt-source-followup-r95-20261108'),r95data=d.records.find(x=>x.id==='gpt-source-followup-r95-20261108-evidence');
assert(r95cat&&r95data&&r95cat.url.endsWith('supplier-followup-20261108-r7.html'));
const r95=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-08/supplier-followup-20261108-r7-evidence.json'),'utf8'));
assert.equal(r95.round,95);assert.equal(r95.site_version,'1.9.103');assert.equal(r95.sources.length,12);
assert.equal(r95.opengptplus.merchant_agent_inventory_min_cards,10);assert.equal(r95.opengptplus.merchant_api_deposit_cny_min,3000);
assert.equal(r95.opengptplus.homepage_now_no_listed_products,true);assert.equal(r95.opengptplus.actual_plus_current_checkout_cny,null);
assert.equal(r95.gpt100x.public_plus_cny_per_account_30days,138);assert.equal(r95.gpt100x.verified_one_item_plus_vat_invoice,false);
assert.equal(r95.gpt100x.actual_all_required_plus_vat_checkout_cny,null);assert.equal(r95.phone_verification.successful_sms_tests,0);
assert.equal(r95.qualification_totals.verified_plus_wholesale_upstreams,0);

// Research round 96: new retail/provenance leads must not be promoted to verified upstream.
const r96cat=d.records.find(x=>x.id==='gpt-source-followup-r96-20261108'),r96data=d.records.find(x=>x.id==='gpt-source-followup-r96-20261108-evidence');
assert(r96cat&&r96data&&r96cat.url.endsWith('supplier-followup-20261108-r8.html'));
const r96=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-08/supplier-followup-20261108-r8-evidence.json'),'utf8'));
assert.equal(r96.round,96);assert.equal(r96.site_version,'1.9.104');assert.equal(r96.sources.length,19);
assert.equal(r96.new_candidates.length,2);assert.equal(r96.new_candidates[0].current_product_checkout_price_cny,null);
assert.equal(r96.new_candidates[1].merchant_advertised_original_account_plus_price_cny_per_month,165);
assert.equal(r96.new_candidates[1].merchant_checkout_price_cny,null);
assert.equal(r96.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r96.phone_verification.successful_web_codex_api_sms_tests,0);

// Round 97: special gpt2- Free restriction is only valid for that SKU.
const r97cat=d.records.find(x=>x.id==='gpt-source-followup-r97-20261108'),r97data=d.records.find(x=>x.id==='gpt-source-followup-r97-20261108-evidence');
assert(r97cat&&r97data&&r97cat.url.endsWith('supplier-followup-20261108-r9.html'));
const r97=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-08/supplier-followup-20261108-r9-evidence.json'),'utf8'));
assert.equal(r97.round,97);assert.equal(r97.site_version,'1.9.105');assert.equal(r97.sources.length,17);
assert.equal(r97.new_evidence.aisubpro_discounted.card_prefix,'gpt2-');
assert.equal(r97.new_evidence.aisubpro_discounted.ordinary_gpt_card_has_same_restriction_proven,false);
assert.equal(r97.new_evidence.okai66_plus.merchant_invoice_total_cny,183);
assert.equal(r97.new_evidence.okai66_plus.all_required_fee_and_verified_china_vat_total_cny,null);
assert.equal(r97.qualification_totals.verified_plus_wholesale_upstreams,0);

// Round 98: claimed wholesale flow and public enterprise MOQ are not paid/authorized verification.
const r98cat=d.records.find(x=>x.id==='gpt-source-followup-r98-20261108'),r98data=d.records.find(x=>x.id==='gpt-source-followup-r98-20261108-evidence');
assert(r98cat&&r98data&&r98cat.url.endsWith('supplier-followup-20261108-r10.html'));
const r98=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-08/supplier-followup-20261108-r10-evidence.json'),'utf8'));
assert.equal(r98.round,98);assert.equal(r98.site_version,'1.9.106');assert.equal(r98.sources.length,13);
assert.equal(r98.new_evidence.v2bk.wholesale_per_account_month_cny,null);
assert.equal(r98.new_evidence.v2bk.merchant_explicitly_no_warranty,true);
assert.equal(r98.new_evidence.getplus.enterprise_purchase_minimum_units,5);
assert.equal(r98.new_evidence.getplus.checkout_total_usd,null);
assert.equal(r98.new_evidence.getplus.phone_field_links_or_verifies_chatgpt_phone,false);
assert.equal(r98.qualification_totals.verified_plus_wholesale_upstreams,0);


// Research round 99: receipt is not a mainland VAT invoice; verifying CDK flow is not permanent number possession.
const r99cat=d.records.find(x=>x.id==='gpt-source-followup-r99-20261108'),r99data=d.records.find(x=>x.id==='gpt-source-followup-r99-20261108-evidence');
assert(r99cat&&r99data&&r99cat.url.endsWith('supplier-followup-20261108-r11.html'));
const r99=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-08/supplier-followup-20261108-r11-evidence.json'),'utf8'));
assert.equal(r99.round,99);assert.equal(r99.site_version,'1.9.107');assert.equal(r99.sources.length,15);
assert.equal(r99.new_evidence.linkai.unsubmitted_checkout_total_cny,150);
assert.equal(r99.new_evidence.linkai.verified_legal_operator,null);
assert.equal(r99.new_evidence.linkai.refund_payment_channel_automatic,false);
assert.equal(r99.new_evidence.yxab.official_receipt_is_valid_china_vat_invoice,false);
assert.equal(r99.new_evidence.yxab.current_listed_inventory_status,'暂时缺货');
assert.equal(r99.new_evidence.callai_codex.price_cny_per_one_verification,3);
assert.equal(r99.new_evidence.callai_codex.long_term_same_number_control,false);
assert.equal(r99.new_evidence.callai_codex.cash_refund_if_unsuccessful_cny,null);
assert.equal(r99.qualification_totals.verified_plus_wholesale_upstreams,0);

const r100cat=d.records.find(x=>x.id==='gpt-source-followup-r100-20261108'),r100data=d.records.find(x=>x.id==='gpt-source-followup-r100-20261108-evidence');
assert(r100cat&&r100data&&r100cat.url.endsWith('supplier-followup-20261108-r12.html'));
const r100=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-08/supplier-followup-20261108-r12-evidence.json'),'utf8'));
assert.equal(r100.round,100);assert.equal(r100.site_version,'1.9.108');assert.equal(r100.sources.length,4);
assert.equal(r100.new_evidence.nianhua_ai_store.displayed_default_product_price_cny,113);
assert.equal(r100.new_evidence.nianhua_ai_store.public_volume_tier_minimum_units,88);
assert.equal(r100.new_evidence.nianhua_ai_store.public_volume_tier_price_cny_per_unit,110);
assert.equal(r100.new_evidence.nianhua_ai_store.displayed_default_price_accurately_identified_as_one_month_plus_sku,false);
assert.equal(r100.new_evidence.nianhua_ai_store.all_required_fees_and_verified_china_vat_invoice_cny,null);
assert.equal(r100.new_evidence.nianhua_ai_store.refund_processing_deduction_cny_claim,5);
assert.equal(r100.qualification_totals.verified_plus_wholesale_upstreams,0);

// Round 101: upstream and SMS remain unverified.
const cat101=d.records.find(x=>x.id==='gpt-source-followup-r101-20261108'),data101=d.records.find(x=>x.id==='gpt-source-followup-r101-20261108-evidence');
assert(cat101&&data101&&cat101.url.endsWith('supplier-followup-20261108-r13.html'));
const r101=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-08/supplier-followup-20261108-r13-evidence.json'),'utf8'));
assert.equal(r101.round,101);assert.equal(r101.site_version,'1.9.109');assert.equal(r101.sources.length,5);
assert.equal(r101.new_evidence.getgpt_plus.displayed_plus_one_account_month_retail_cny,138);
assert.equal(r101.new_evidence.getgpt_plus.merchant_explicitly_cannot_confirm_automated_upstream_operator_and_server_region,true);
assert.equal(r101.new_evidence.getgpt_plus.all_required_fees_with_verified_china_vat_invoice_cny,null);
assert.equal(r101.new_evidence.upchatgpt_pro_legacy_redirect.is_new_supplier,false);
assert.equal(r101.qualification_totals.verified_plus_wholesale_upstreams,0);

// Round 102: confirmed merchant-displayed invoice options exceed the ceiling; never classify a merchant promise as an authenticated Chinese VAT invoice.
const cat102=d.records.find(x=>x.id==='gpt-source-followup-r102-20261108'),data102=d.records.find(x=>x.id==='gpt-source-followup-r102-20261108-evidence');
assert(cat102&&data102&&cat102.url.endsWith('supplier-followup-20261108-r14.html'));
const r102=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-08/supplier-followup-20261108-r14-evidence.json'),'utf8'));
assert.equal(r102.round,102);assert.equal(r102.site_version,'1.9.110');assert.equal(r102.sources.length,11);
assert.equal(r102.new_evidence.xiaoyangplus.price_cny_per_unit,169);
assert.equal(r102.new_evidence.xiaoyangplus.invoice_option_display_cny_per_unit,179);
assert.equal(r102.new_evidence.xiaoyangplus.invoice_issuer_verified,null);
assert.equal(r102.new_evidence.steadflow.homepage_invoice_option_cny_per_month,180);
assert.equal(r102.new_evidence.steadflow.faq_older_price_cny_per_month,148);
assert.equal(r102.new_evidence.steadflow.merchant_terms_prohibit_resale_and_shared_accounts,true);
assert.equal(r102.qualification_totals.verified_plus_wholesale_upstreams,0);


// Round 103: a single-quantity retail price plus an invoice application claim is NOT a verified wholesale VAT-inclusive offer.
const cat103=d.records.find(x=>x.id==='gpt-source-followup-r103-20261108'),data103=d.records.find(x=>x.id==='gpt-source-followup-r103-20261108-evidence');
assert(cat103&&data103&&cat103.url.endsWith('supplier-followup-20261108-r15.html'));
const r103=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-08/supplier-followup-20261108-r15-evidence.json'),'utf8'));
assert.equal(r103.round,103);assert.equal(r103.site_version,'1.9.111');assert.equal(r103.sources.length,7);
assert.equal(r103.new_evidence.payai_plus.displayed_retail_price_cny_per_account_month,169);
assert.equal(r103.new_evidence.payai_plus.invoice_application_window_days_merchant_claim,7);
assert.equal(r103.new_evidence.payai_plus.chinese_vat_invoice_fee_cny,null);
assert.equal(r103.new_evidence.payai_plus.requires_full_authsession_json_at_third_party_redeem,true);
assert.equal(r103.new_evidence.payai_plus.qualifies_as_verified_wholesale_upstream,false);
assert.equal(r103.qualification_totals.verified_plus_wholesale_upstreams,0);


// Round 104: an explicit reseller entry payment disqualifies an otherwise low displayed Plus CDK price.
const cat104=d.records.find(x=>x.id==='gpt-source-followup-r104-20261108'),data104=d.records.find(x=>x.id==='gpt-source-followup-r104-20261108-evidence');
assert(cat104&&data104&&cat104.url.endsWith('supplier-followup-20261108-r16.html'));
const r104=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-08/supplier-followup-20261108-r16-evidence.json'),'utf8'));
assert.equal(r104.round,104);assert.equal(r104.site_version,'1.9.112');assert.equal(r104.sources.length,5);
assert.equal(r104.new_evidence.suzhe_ai.observed_agent_price_cny_per_one_month_cdk,115);
assert.equal(r104.new_evidence.suzhe_ai.upfront_agent_pass_one_time_cny,29.99);
assert.equal(r104.new_evidence.suzhe_ai.plus_requires_no_active_subscription,true);
assert.equal(r104.new_evidence.suzhe_ai.all_required_fees_with_verified_china_vat_invoice_cny,null);
assert.equal(r104.new_evidence.suzhe_ai.qualifies_as_verified_wholesale_upstream,false);
assert.equal(r104.independent_phone_verification.observed_price_cny_per_sms_cdk,null);
assert.equal(r104.independent_phone_verification.merchant_claim_auto_cancel_if_no_sms_after_minutes,20);
assert.equal(r104.qualification_totals.verified_plus_wholesale_upstreams,0);

// Round 105: independently read merchant products separate from stale third-party index prices.
const cat105=d.records.find(x=>x.id==='gpt-source-followup-r105-20261108'),data105=d.records.find(x=>x.id==='gpt-source-followup-r105-20261108-evidence');
assert(cat105&&data105&&cat105.url.endsWith('supplier-followup-20261108-r17.html'));
const r105=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-08/supplier-followup-20261108-r17-evidence.json'),'utf8'));
assert.equal(r105.round,105);assert.equal(r105.site_version,'1.9.113');assert.equal(r105.sources.length,6);
assert.equal(r105.new_evidence.ai_access_hub.merchant_display_channel_1_card_payment_cny,119);
assert.equal(r105.new_evidence.ai_access_hub.merchant_says_alipay_fee_percent,5);
assert.equal(r105.new_evidence.ai_access_hub.merchant_channel_1_refund_service_fee_percent,20);
assert.equal(r105.new_evidence.quanxin_store.merchant_display_channel_3_ios_cny,128);
assert.equal(r105.new_evidence.zhang_hao_shang.verified_current_first_party_price_cny,null);
assert.equal(r105.qualification_totals.verified_plus_wholesale_upstreams,0);

// Round 106: merchant first-party checkout price and separate SMS rights, not validated wholesale.
const cat106=d.records.find(x=>x.id==='gpt-source-followup-r106-20261108'),data106=d.records.find(x=>x.id==='gpt-source-followup-r106-20261108-evidence');
assert(cat106&&data106&&cat106.url.endsWith('supplier-followup-20261108-r18.html'));
const r106=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-08/supplier-followup-20261108-r18-evidence.json'),'utf8'));
assert.equal(r106.round,106);assert.equal(r106.site_version,'1.9.114');assert.equal(r106.sources.length,9);
assert.equal(r106.new_evidence.gpt_bu_gei_zhan.plus_listed_cny_per_card,125);
assert.equal(r106.new_evidence.gpt_bu_gei_zhan.plus_period_months_confirmed_on_card,null);
assert.equal(r106.new_evidence.gpt_bu_gei_zhan.online_payment_fee_percent_claim,3);
assert.equal(r106.new_evidence.codex_sms.merchant_listed_cny_per_receive_right,8);
assert.equal(r106.new_evidence.codex_sms.rights_expire_after_days,30);
assert.equal(r106.new_evidence.codex_sms.exclusive_number_control_days,null);
assert.equal(r106.new_evidence.codex_sms.cash_refund_if_sms_not_received_verified,null);
assert.equal(r106.qualification_totals.verified_plus_wholesale_upstreams,0);

// Round 107: true one-month retail offer, VAT not verified, +44 SMS is separate from Plus.
const cat107=d.records.find(x=>x.id==='gpt-source-followup-r107-20261109'),data107=d.records.find(x=>x.id==='gpt-source-followup-r107-20261109-evidence');
assert(cat107&&data107&&cat107.url.endsWith('supplier-followup-20261109.html'));
const r107=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-09/supplier-followup-20261109-evidence.json'),'utf8'));
assert.equal(r107.round,107);assert.equal(r107.site_version,'1.9.115');assert.equal(r107.sources.length,6);
assert.equal(r107.new_evidence.xiyueai_plus.merchant_listed_price_cny_per_own_account_month,118);
assert.equal(r107.new_evidence.xiyueai_plus.merchant_visible_purchase_preview_total_cny,119.77);
assert.equal(r107.new_evidence.xiyueai_plus.verified_single_unit_wholesale_cost_cny,null);
assert.equal(r107.new_evidence.xiyueai_plus.all_required_payment_and_valid_china_vat_invoice_cny,null);
assert.equal(r107.new_evidence.xiyueai_plus.requires_full_authsession_json_including_access_token,true);
assert.equal(r107.new_evidence.xiyueai_sms.merchant_price_cny_per_sms_right,8);
assert.equal(r107.new_evidence.xiyueai_sms.phone_exclusive_control_minutes_merchant_claim_approx,20);
assert.equal(r107.new_evidence.xiyueai_sms.cash_refund_if_no_sms_verified,null);
assert.equal(r107.new_evidence.payforchat_retail_exclusion.seller_explicitly_cannot_issue_mainland_china_vat_invoice,true);
assert.equal(r107.qualification_totals.verified_plus_wholesale_upstreams,0);

// Round 108: ¥95 crypto-only retail excluded by merchant explicit no-VAT and resale ban.
const cat108=d.records.find(x=>x.id==='gpt-source-followup-r108-20261109'),data108=d.records.find(x=>x.id==='gpt-source-followup-r108-20261109-evidence');
assert(cat108&&data108&&cat108.url.endsWith('supplier-followup-20261109-r2.html'));
const r108=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-09/supplier-followup-20261109-r2-evidence.json'),'utf8'));
assert.equal(r108.round,108);assert.equal(r108.site_version,'1.9.116');assert.equal(r108.sources.length,8);
assert.equal(r108.new_evidence.cdkstore.observed_retail_listed_cny_per_account_month,95);
assert.equal(r108.new_evidence.cdkstore.seller_explicitly_says_no_vat_invoice,true);
assert.equal(r108.new_evidence.cdkstore.buyer_resale_explicitly_prohibited,true);
assert.equal(r108.new_evidence.cdkstore.verified_actual_checkout_cny,null);
assert.equal(r108.new_evidence.cdkstore.formal_wholesale_supply_resale_authorization_verified,null);
assert.equal(r108.new_evidence.cdkstore.requires_chatgpt_access_token,true);
assert.equal(r108.qualification_totals.verified_plus_wholesale_upstreams,0);

// Round 109: V3 first-party monthly SKUs, fee disclosure, resale gate and separate untested SMSPool.
const cat109=d.records.find(x=>x.id==='gpt-source-followup-r109-20261109'),data109=d.records.find(x=>x.id==='gpt-source-followup-r109-20261109-evidence');
assert(cat109&&data109&&cat109.url.endsWith('supplier-followup-20261109-r3.html'));
const r109=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-09/supplier-followup-20261109-r3-evidence.json'),'utf8'));
assert.equal(r109.round,109);assert.equal(r109.site_version,'1.9.117');assert.equal(r109.sources.length,9);
assert.equal(r109.new_evidence.v3_shop.channel_ph_card.retail_display_cny_per_one_account_month,133.5);
assert.equal(r109.new_evidence.v3_shop.channel_ios.retail_display_cny_per_one_account_month,143.5);
assert.equal(r109.new_evidence.v3_shop.merchant_display_wechat_payment_fee_percent,3.5);
assert.equal(r109.new_evidence.v3_shop.terms_forbid_resale_without_permission,true);
assert.equal(r109.new_evidence.v3_shop.actual_alipay_final_paid_cny,null);
assert.equal(r109.new_evidence.v3_shop.valid_china_vat_invoice_issuer_verified,null);
assert.equal(r109.independent_phone_verification.unique_openai_codex_sms_price_usd,null);
assert.equal(r109.independent_phone_verification.no_sms_original_payment_cash_refund_verified,null);
assert.equal(r109.qualification_totals.verified_plus_wholesale_upstreams,0);

// Round 110: first-party retail and independent SMS; activation maintenance is not verified successful delivery.
const cat110=d.records.find(x=>x.id==='gpt-source-followup-r110-20261109'),data110=d.records.find(x=>x.id==='gpt-source-followup-r110-20261109-evidence');
assert(cat110&&data110&&cat110.url.endsWith('supplier-followup-20261109-r4.html'));
const r110=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-09/supplier-followup-20261109-r4-evidence.json'),'utf8'));
assert.equal(r110.round,110);assert.equal(r110.site_version,'1.9.118');assert.equal(r110.sources.length,11);
assert.equal(r110.new_evidence.callai_plus.retail_display_cny_per_account_month,108);
assert.equal(r110.new_evidence.callai_plus.wholesale_unit_price_cny,null);
assert.equal(r110.new_evidence.callai_plus.activation_service_under_maintenance_notice_observed,true);
assert.equal(r110.new_evidence.codex_sms.merchant_display_cny_per_verification_cdk,3);
assert.equal(r110.new_evidence.codex_sms.sms_flow_asks_password_or_email_otp_or_mfa,true);
assert.equal(r110.qualification_totals.verified_plus_wholesale_upstreams,0);

// Round 111: old merchant terms newly read, explicit resale prohibition, refund still untested.
const cat111=d.records.find(x=>x.id==='gpt-source-followup-r111-20261109'),data111=d.records.find(x=>x.id==='gpt-source-followup-r111-20261109-evidence');
assert(cat111&&data111&&cat111.url.endsWith('supplier-followup-20261109-r5.html'));
const r111=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-09/supplier-followup-20261109-r5-evidence.json'),'utf8'));
assert.equal(r111.round,111);assert.equal(r111.site_version,'1.9.119');assert.equal(r111.sources.length,5);
assert.equal(r111.newly_read_terms.explicitly_forbids_reselling_codes,true);
assert.equal(r111.newly_read_terms.page_self_last_updated,'2026-08-20');
assert.equal(r111.newly_read_privacy.upstream_card_suppliers_explicitly_mentioned_as_data_recipients,true);
assert.equal(r111.historical_candidate_reference.historical_checkout_preview_cny,149.78);
assert.equal(r111.historical_candidate_reference.price_change_verified_this_round,false);
assert.equal(r111.qualification_totals.verified_plus_wholesale_upstreams,0);

// Round 112: public fee math excludes new retail candidate; SMS is one-time and activation requires Session.
const cat112=d.records.find(x=>x.id==='gpt-source-followup-r112-20261109'),data112=d.records.find(x=>x.id==='gpt-source-followup-r112-20261109-evidence');
assert(cat112&&data112&&cat112.url.endsWith('supplier-followup-20261109-r6.html'));
const r112=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-09/supplier-followup-20261109-r6-evidence.json'),'utf8'));
assert.equal(r112.round,112);assert.equal(r112.site_version,'1.9.120');assert.equal(r112.sources.length,8);
assert.equal(r112.new_evidence.gptpro_plus.retail_display_cny_per_account_month,168);
assert.equal(r112.new_evidence.gptpro_plus.china_vat_general_invoice_extra_percent_merchant_claim,6);
assert.equal(r112.new_evidence.gptpro_plus.merchant_component_math_alipay_with_invoice_cny,178.08);
assert.equal(r112.new_evidence.gptpro_plus.sensitive_session_json_needed_downstream,true);
assert.equal(r112.new_evidence.codex_sms.display_cny_per_attempt,10);
assert.equal(r112.new_evidence.codex_sms.merchant_claim_re_receive_sms_supported,false);
assert.equal(r112.qualification_totals.verified_plus_wholesale_upstreams,0);

// Round 113: APIHub first-party reseller claims versus no-invoice platform checkout; third-party index prices are not first-party prices.
const cat113=d.records.find(x=>x.id==='gpt-source-followup-r113-20261109'),data113=d.records.find(x=>x.id==='gpt-source-followup-r113-20261109-evidence');
assert(cat113&&data113&&cat113.url.endsWith('supplier-followup-20261109-r7.html'));
const r113=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-09/supplier-followup-20261109-r7-evidence.json'),'utf8'));
assert.equal(r113.round,113);assert.equal(r113.site_version,'1.9.121');assert.equal(r113.sources.length,4);
assert.equal(r113.new_candidate.merchant_claim_platform_checkout_no_invoice,true);
assert.equal(r113.new_candidate.merchant_claim_enterprise_procurement_invoice_separately_quoted,true);
assert.equal(r113.new_candidate.plus_first_party_price_cny_per_account_month,null);
assert.equal(r113.new_candidate.agent_upfront_fee_cny_verified,null);
assert.equal(r113.new_candidate.all_required_fees_including_vat_cny,null);
assert.equal(r113.new_candidate.qualified_plus_wholesale_source,false);
assert.equal(r113.qualification_totals.verified_plus_wholesale_upstreams,0);

// Round 114: seller-claimed VAT-included one-seat pricing is not a verified VAT invoice/wholesale right.
const r114cat=d.records.find(x=>x.id==='gpt-source-followup-r114-20261110'),r114data=d.records.find(x=>x.id==='gpt-source-followup-r114-20261110-evidence');
assert(r114cat&&r114data);
const r114=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-10/supplier-followup-20261110-evidence.json'),'utf8'));
assert.equal(r114.round,114);assert.equal(r114.site_version,'1.9.122');assert.equal(r114.sources.length,5);
assert.equal(r114.new_candidate.public_plus_1_to_4_seats_monthly_cny_per_seat,165);
assert.equal(r114.new_candidate.merchant_claim_price_includes_six_percent_china_vat_special_invoice,true);
assert.equal(r114.new_candidate.masked_invoice_demo_contains_placeholders,true);
assert.equal(r114.new_candidate.actual_invoice_tax_platform_checked,false);
assert.equal(r114.new_candidate.all_required_fees_and_real_valid_china_vat_total_cny,null);
assert.equal(r114.qualification_totals.verified_plus_wholesale_upstreams,0);

// Round 115: provenance erratum must reference r13/r37/r38; the old r114 artifact stays byte-identical.
const r115cat=d.records.find(x=>x.id==='gpt-source-followup-r115-20261110'),r115data=d.records.find(x=>x.id==='gpt-source-followup-r115-20261110-evidence');
assert(r115cat&&r115data&&r115cat.url.endsWith('supplier-followup-20261110-r2.html'));
const r115=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-10/supplier-followup-20261110-r2-evidence.json'),'utf8'));
assert.equal(r115.round,115);assert.equal(r115.site_version,'1.9.123');assert.equal(r115.correction.target_round,114);
assert.equal(r115.correction.first_observed_merchant_on,'2026-11-03');
assert.deepEqual(r115.correction.prior_evidence.map(x=>x.round),[13,37,38,114]);
assert.equal(r115.correction.price_changed_this_round,false);
assert.equal(r115.correction.historical_records_preserved_unmodified,true);
assert.equal(r115.sources.length,10);
assert.equal(r115.current_recheck.verified_all_required_fees_cny,null);
assert.equal(r115.qualification_totals.verified_plus_wholesale_upstreams,0);


// Round 116: SMS seller's refund after zero texts and yxab different SKU must not be confused with Plus wholesale or old SKU restock.
const r116cat=d.records.find(x=>x.id==='gpt-source-followup-r116-20261110');
const r116data=d.records.find(x=>x.id==='gpt-source-followup-r116-20261110-evidence');
assert(r116cat&&r116data&&r116cat.url.endsWith('supplier-followup-20261110-r3.html'));
const r116=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-10/supplier-followup-20261110-r3-evidence.json'),'utf8'));
assert.equal(r116.round,116);assert.equal(r116.site_version,'1.9.124');assert.equal(r116.sources.length,7);
assert.equal(r116.new_evidence.pay2gpt_sms.public_price_number,3.49);
assert.equal(r116.new_evidence.pay2gpt_sms.public_price_currency,'USD');
assert.equal(r116.new_evidence.pay2gpt_sms.number_control_days_merchant_claim,21);
assert.equal(r116.new_evidence.pay2gpt_sms.free_replacements_max_merchant_claim,2);
assert.equal(r116.new_evidence.pay2gpt_sms.merchant_claim_original_payment_method_refund_if_no_number_or_no_any_sms,true);
assert.equal(r116.new_evidence.pay2gpt_sms.merchant_claim_no_refund_once_any_sms_received,true);
assert.equal(r116.new_evidence.pay2gpt_sms.openai_account_phone_verification_success_count,0);
assert.equal(r116.new_evidence.pay2gpt_sms.qualifies_as_plus_wholesale,false);
assert.equal(r116.new_evidence.yxab_plus_new_sku.old_sku_id,'G69666080');
assert.equal(r116.new_evidence.yxab_plus_new_sku.new_sku_id,'G62975691');
assert.equal(r116.new_evidence.yxab_plus_new_sku.old_sku_restock_proven,false);
assert.equal(r116.new_evidence.yxab_plus_new_sku.new_sku_public_price_cny_per_account_month,128.8);
assert.equal(r116.new_evidence.yxab_plus_new_sku.payment_channel_fee_cny,null);
assert.equal(r116.qualification_totals.verified_plus_wholesale_upstreams,0);

// R117: enforce snapshot-vs-checkout, minimum cash, balance refund and zero success.
const r117c=d.records.find(x=>x.id==='gpt-source-followup-r117-20261110');
const r117d=d.records.find(x=>x.id==='gpt-source-followup-r117-20261110-evidence');
assert(r117c&&r117d&&r117c.url.endsWith('supplier-followup-20261110-r4.html'));
const r117=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-10/supplier-followup-20261110-r4-evidence.json'),'utf8'));
assert.equal(r117.round,117);assert.equal(r117.site_version,'1.9.125');assert.equal(r117.sources.length,5);
assert.equal(r117.new_evidence.public_price_number,0.05);
assert.equal(r117.new_evidence.price_table_snapshot_date,'2026-10-31');
assert.equal(r117.new_evidence.actual_checkout_live_price_usd,null);
assert.equal(r117.new_evidence.minimum_topup_usd,5);
assert.equal(r117.new_evidence.minimum_card_cash_outlay_arithmetic_usd,5.5);
assert.equal(r117.new_evidence.no_sms_returns_to_platform_balance_merchant_claim,true);
assert.equal(r117.new_evidence.cash_refund_no_sms_automatic,false);
assert.equal(r117.new_evidence.received_sms_charged_even_if_openai_rejects_merchant_claim,true);
assert.equal(r117.new_evidence.codex_desktop_success_verified,false);
assert.equal(r117.new_evidence.first_api_key_success_verified,false);
assert.equal(r117.new_evidence.qualifies_as_plus_wholesale,false);
assert.equal(r117.qualification_totals.verified_plus_wholesale_upstreams,0);

// R118: same independent-SMS SKU; multilingual promo and unpaid checkout must remain separate from real payment.
const r118c=d.records.find(x=>x.id==='gpt-source-followup-r118-20261110');
const r118d=d.records.find(x=>x.id==='gpt-source-followup-r118-20261110-evidence');
assert(r118c&&r118d&&r118c.url.endsWith('supplier-followup-20261110-r5.html'));
const r118=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-10/supplier-followup-20261110-r5-evidence.json'),'utf8'));
assert.equal(r118.round,118);assert.equal(r118.site_version,'1.9.126');assert.equal(r118.sources.length,5);
assert.equal(r118.new_evidence.current_english_product_page_display_usd,3.49);
assert.equal(r118.new_evidence.current_chinese_product_page_display_usd,4.99);
assert.equal(r118.new_evidence.current_chinese_homepage_display_usd,4.99);
assert.equal(r118.new_evidence.checkout_english_base_price_preview_usd,4.99);
assert.equal(r118.new_evidence.checkout_service_fee_percent_display,5);
assert.equal(r118.new_evidence.checkout_preview_total_usd,5.24);
assert.equal(r118.new_evidence.real_payment_usd,null);
assert.equal(r118.new_evidence.price_change_effective_date_verified,null);
assert.equal(r118.new_evidence.qualifies_as_plus_wholesale,false);
assert.equal(r118.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r118.qualification_totals.verified_phone_sms_successes,0);

// R119: quote category and SKU warranty boundary; never make generic SMS an OpenAI confirmed code.
const r119c=d.records.find(x=>x.id==='gpt-source-followup-r119-20261110');
const r119d=d.records.find(x=>x.id==='gpt-source-followup-r119-20261110-evidence');
assert(r119c&&r119d&&r119c.url.endsWith('supplier-followup-20261110-r6.html'));
const r119=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-10/supplier-followup-20261110-r6-evidence.json'),'utf8'));
assert.equal(r119.round,119);assert.equal(r119.site_version,'1.9.127');assert.equal(r119.sources.length,8);
assert.equal(r119.new_evidence.reference_gptplus_previous_usdt,15.8);
assert.equal(r119.new_evidence.reference_gptplus_current_usdt,16.2);
assert.equal(r119.new_evidence.reference_display_difference_usdt,0.4);
assert.equal(r119.new_evidence.authenticated_wholesale_quote_usdt,null);
assert.equal(r119.new_evidence.gptplus_google_merchant_claim_non_warranty,true);
assert.equal(r119.new_evidence.gptplus_google_actual_drop_risk_verified,false);
assert.equal(r119.new_evidence.generic_sms.openai_specific_price_usdt,null);
assert.equal(r119.new_evidence.plus_actual_all_in_with_china_vat_cny,null);
assert.equal(r119.new_evidence.qualifies_as_verified_plus_wholesale,false);
assert.equal(r119.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r119.qualification_totals.verified_phone_sms_successes,0);

// R120: retail invoice arithmetic is not paid valid VAT; SMS homepage is not a purchasable price.
const r120c=d.records.find(x=>x.id==='gpt-source-followup-r120-20261110');
const r120d=d.records.find(x=>x.id==='gpt-source-followup-r120-20261110-evidence');
assert(r120c&&r120d&&r120c.url.endsWith('supplier-followup-20261110-r7.html'));
const r120=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-10/supplier-followup-20261110-r7-evidence.json'),'utf8'));
assert.equal(r120.round,120);assert.equal(r120.site_version,'1.9.128');assert.equal(r120.sources.length,7);
assert.equal(r120.new_evidence.plus.public_retail_price_cny_per_original_account_month,148);
assert.equal(r120.new_evidence.plus.advertised_components_sum_cny,155.4);
assert.equal(r120.new_evidence.plus.actual_paid_all_in_with_valid_china_vat_invoice_cny,null);
assert.equal(r120.new_evidence.plus.requires_full_session_json_submission,true);
assert.equal(r120.new_evidence.plus.affiliate_is_wholesale,false);
assert.equal(r120.new_evidence.independent_sms.home_cheap_tier.advertised_cny_per_number,4.9);
assert.equal(r120.new_evidence.independent_sms.home_long_tier.advertised_cny_per_number,9.9);
assert.equal(r120.new_evidence.independent_sms.product_detail_supports_online_order,false);
assert.equal(r120.new_evidence.independent_sms.actual_buyable_sms_price_cny,null);
assert.equal(r120.new_evidence.independent_sms.cash_refund_on_sms_failure,null);
assert.equal(r120.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r120.qualification_totals.verified_phone_sms_successes,0);


// R121: merchant invoice arithmetic and advertised same-price agent label are not paid/verified wholesale.
const r121c=d.records.find(x=>x.id==='gpt-source-followup-r121-20261110');
const r121d=d.records.find(x=>x.id==='gpt-source-followup-r121-20261110-evidence');
assert(r121c&&r121d&&r121c.url.endsWith('supplier-followup-20261110-r8.html'));
const r121=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-10/supplier-followup-20261110-r8-evidence.json'),'utf8'));
assert.equal(r121.round,121);assert.equal(r121.site_version,'1.9.129');assert.equal(r121.sources.length,8);
assert.equal(r121.new_evidence.uppluspro.advertised_retail_cny_per_account_month,143);
assert.equal(r121.new_evidence.uppluspro.merchant_claim_china_vat_e_invoice_fee_cny,10);
assert.equal(r121.new_evidence.uppluspro.advertised_component_sum_cny,153);
assert.equal(r121.new_evidence.uppluspro.actual_paid_all_in_with_valid_china_vat_cny,null);
assert.equal(r121.new_evidence.uppluspro.requires_session_json,true);
assert.equal(r121.new_evidence.gptstore.advertised_retail_usd_per_card,16);
assert.equal(r121.new_evidence.gptstore.advertised_vip_agent_usd_per_card,16);
assert.equal(r121.new_evidence.gptstore.public_price_spread_usd,0);
assert.equal(r121.new_evidence.gptstore.actual_paid_all_in_with_valid_china_vat_cny,null);
assert.equal(r121.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r121.qualification_totals.verified_phone_sms_successes,0);

// R122: vendor public warranty label, not verified underlying order guarantee.
const r123c=d.records.find(x=>x.id==='gpt-source-followup-r123-20261110');
const r123d=d.records.find(x=>x.id==='gpt-source-followup-r123-20261110-evidence');
assert(r123c&&r123d&&r123c.url.endsWith('supplier-followup-20261110-r10.html'));
const r123=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-10/supplier-followup-20261110-r10-evidence.json'),'utf8'));
assert.equal(r123.round,123);assert.equal(r123.site_version,'1.9.131');assert.equal(r123.sources.length,7);
assert.equal(r123.new_evidence.advertised_retail_cny_per_free_existing_account_month,139.99);
assert.equal(r123.new_evidence.merchant_claim_china_vat_e_invoice_fee_cny,10);
assert.equal(r123.new_evidence.storefront_says_guest_order_can_invoice_after_signin_with_original_order_email,true);
assert.equal(r123.new_evidence.invoice_guide_says_guest_order_has_no_invoice_entry,true);
assert.equal(r123.new_evidence.actual_guest_invoice_success_verified,null);
assert.equal(r123.new_evidence.actual_paid_all_in_with_valid_china_vat_cny,null);
assert.equal(r123.phone_verification.chatgpt_web_success_verified,false);
assert.equal(r123.qualification_totals.verified_plus_wholesale_upstreams,0);
const r122c=d.records.find(x=>x.id==='gpt-source-followup-r122-20261110');
const r122d=d.records.find(x=>x.id==='gpt-source-followup-r122-20261110-evidence');
assert(r122c&&r122d&&r122c.url.endsWith('supplier-followup-20261110-r9.html'));
const r122=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-10/supplier-followup-20261110-r9-evidence.json'),'utf8'));
assert.equal(r122.round,122);assert.equal(r122.site_version,'1.9.130');assert.equal(r122.sources.length,4);
assert.equal(r122.historical_comparison.old_skus[0].warranty_mark,false);
assert.equal(r122.new_evidence.merchant_claim_warranty_days,30);
assert.equal(r122.new_evidence.verified_mapping_of_old_two_skus_to_new_generic_sku,null);
assert.equal(r122.new_evidence.actual_paid_all_in_with_china_vat_cny,null);
assert.equal(r122.qualification_totals.verified_plus_wholesale_upstreams,0);

// R124: merchant coupon is not cash or a verified registration success.
const r124a=d.records.find(x=>x.id==='gpt-source-followup-r124-20261110');
const r124b=d.records.find(x=>x.id==='gpt-source-followup-r124-20261110-evidence');
assert(r124a&&r124b&&r124a.url.endsWith('supplier-followup-20261110-r11.html'));
const r124=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-10/supplier-followup-20261110-r11-evidence.json'),'utf8'));
assert.equal(r124.round,124);assert.equal(r124.sources.length,5);
assert.equal(r124.new_evidence.plus_current_retail_cny_per_account_month,null);
assert.equal(r124.new_evidence.coupon.coupon_only_issued_after_completed_subscription,true);
assert.equal(r124.new_evidence.coupon.max_coupon_count_at_completed_higher_tier,3);
assert.equal(r124.phone_verification.verified_number_control_days,null);
assert.equal(r124.qualifIcation_totals,undefined);
assert.equal(r124.qualification_totals.verified_plus_wholesale_upstreams,0);

// R126: Go-only tier pricing and card resale ban do not meet Plus wholesale requirements.
const r126a=d.records.find(x=>x.id==='gpt-source-followup-r126-20261110');
const r126b=d.records.find(x=>x.id==='gpt-source-followup-r126-20261110-evidence');
assert(r126a&&r126b&&r126a.url.endsWith('supplier-followup-20261110-r13.html'));
const r126=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-10/supplier-followup-20261110-r13-evidence.json'),'utf8'));
assert.equal(r126.round,126);assert.equal(r126.site_version,'1.9.134');assert.equal(r126.sources.length,8);
assert.equal(r126.new_evidence.dingyue.actual_plus_wholesale_unit_usd,null);
assert.equal(r126.new_evidence.dingyue.api_docs_example_is_actual_wholesale_price,false);
assert.equal(r126.new_evidence.token5555.unpaid_display_total_cny,149.78);
assert.equal(r126.new_evidence.token5555.merchant_terms_ban_resale,true);
assert.equal(r126.qualification_totals.verified_plus_wholesale_upstreams,0);

// R125: English marketing display convergence does not prove paid checkout repricing.
const r125a=d.records.find(x=>x.id==='gpt-source-followup-r125-20261110');
const r125b=d.records.find(x=>x.id==='gpt-source-followup-r125-20261110-evidence');
assert(r125a&&r125b&&r125a.url.endsWith('supplier-followup-20261110-r12.html'));
const r125=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-10/supplier-followup-20261110-r12-evidence.json'),'utf8'));
assert.equal(r125.round,125);assert.equal(r125.site_version,'1.9.133');assert.equal(r125.sources.length,4);
assert.equal(r125.historical_comparison.previous_english_product_display_usd,3.49);
assert.equal(r125.new_evidence.english_product_display_usd_per_number,4.99);
assert.equal(r125.new_evidence.chinese_product_display_usd_per_number,4.99);
assert.equal(r125.new_evidence.english_promo_display_difference_vs_r118_usd,1.5);
assert.equal(r125.new_evidence.unpaid_checkout_total_usd,5.24);
assert.equal(r125.new_evidence.unpaid_checkout_base_and_total_changed_vs_r118,false);
assert.equal(r125.new_evidence.realized_price_increase_proven,false);
assert.equal(r125.new_evidence.actual_paid_total_usd,null);
assert.equal(r125.new_evidence.first_api_key_success_verified,false);
assert.equal(r125.new_evidence.qualifies_as_verified_plus_wholesale,false);
assert.equal(r125.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r125.qualification_totals.verified_phone_sms_successes,0);


// R127: verified direct storefront link is neither paid wholesale price nor a VAT invoice.
const r127a=d.records.find(x=>x.id==='gpt-source-followup-r127-20261110');
const r127b=d.records.find(x=>x.id==='gpt-source-followup-r127-20261110-evidence');
assert(r127a&&r127b&&r127a.url.endsWith('supplier-followup-20261110-r14.html'));
const r127=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-10/supplier-followup-20261110-r14-evidence.json'),'utf8'));
assert.equal(r127.round,127);assert.equal(r127.site_version,'1.9.135');assert.equal(r127.sources.length,9);
assert.equal(r127.new_evidence.catfk_display_unit_price_cny,113);
assert.equal(r127.new_evidence.direct_display_unit_price_cny,110);
assert.equal(r127.new_evidence.cross_platform_display_difference_cny,3);
assert.equal(r127.new_evidence.actual_single_unit_wholesale_unit_price_cny,null);
assert.equal(r127.new_evidence.valid_china_vat_total_cny,null);
assert.equal(r127.new_evidence.demonstrated_new_price_change,false);
assert.equal(r127.new_evidence.bank_receipt_is_china_vat_invoice,false);
assert.equal(r127.phone_verification.codex_credit_is_sms,false);
assert.equal(r127.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r127.qualification_totals.verified_phone_sms_successes,0);


// R128: previously unindexed October terms are new evidence, not a new price or policy change.
const r128a=d.records.find(x=>x.id==='gpt-source-followup-r128-20261111');
const r128b=d.records.find(x=>x.id==='gpt-source-followup-r128-20261111-evidence');
assert(r128a&&r128b&&r128a.url.endsWith('supplier-followup-20261111.html'));
const r128=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-11/supplier-followup-20261111-evidence.json'),'utf8'));
assert.equal(r128.round,128);assert.equal(r128.site_version,'1.9.136');assert.equal(r128.sources.length,7);
assert.equal(r128.new_evidence.existing_account_sku_public_retail_cny_per_account_month,155);
assert.equal(r128.new_evidence.one_unit_wholesale_price_cny,null);
assert.equal(r128.new_evidence.valid_china_vat_invoice_verified,false);
assert.equal(r128.new_evidence.warranty_compensation_requires_matching_official_refund_email,true);
assert.equal(r128.new_evidence.merchant_guarantees_successful_sms_or_openai_verification,false);
assert.equal(r128.phone_verification.accurate_codex_sms_current_price_cny,null);
assert.equal(r128.historical_comparison.newly_read_old_dated_terms_are_new_policy_changes,false);
assert.equal(r128.qualification_totals.verified_plus_wholesale_upstreams,0);

// R129 GetPlus retail cannot count as an approved one-unit upstream.
const r129a=d.records.find(x=>x.id==='gpt-source-followup-r129-20261111');
const r129b=d.records.find(x=>x.id==='gpt-source-followup-r129-20261111-evidence');
assert(r129a&&r129b&&r129a.url.endsWith('supplier-followup-20261111-r2.html'));
const r129=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-11/supplier-followup-20261111-r2-evidence.json'),'utf8'));
assert.equal(r129.round,129);assert.equal(r129.site_version,'1.9.137');assert.equal(r129.sources.length,5);
assert.equal(r129.new_evidence.enterprise_minimum_quantity,5);
assert.equal(r129.new_evidence.merchant_terms_disallow_orders_physically_within_mainland_china,true);
assert.equal(r129.new_evidence.retail_single_usd_per_month,22.14);
assert.equal(r129.new_evidence.invoice_option_addon_usd,2.10);
assert.equal(r129.new_evidence.actual_paid_with_valid_china_vat_total_cny,null);
assert.equal(r129.qualification_totals.verified_plus_wholesale_upstreams,0);

// R130: retailer metadata disclosure and Apple+Session coexist; no VAT/wholesale/SMS success.
const r130a=d.records.find(x=>x.id==='gpt-source-followup-r130-20261111');
const r130b=d.records.find(x=>x.id==='gpt-source-followup-r130-20261111-evidence');
assert(r130a&&r130b&&r130a.url.endsWith('supplier-followup-20261111-r3.html'));
const r130=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-11/supplier-followup-20261111-r3-evidence.json'),'utf8'));
assert.equal(r130.round,130);assert.equal(r130.site_version,'1.9.138');assert.equal(r130.sources.length,7);
assert.equal(r130.new_evidence.plus6.public_retail_cny_per_account_month,145);
assert.equal(r130.new_evidence.plus6.merchant_says_forwards_session_to_third_party_verification_api,true);
assert.equal(r130.new_evidence.plus6.independent_codex_sms_price_cny,null);
assert.equal(r130.new_evidence.gptdcvip.public_retail_cny_per_account_month,139);
assert.equal(r130.new_evidence.gptdcvip.merchant_requires_existing_logged_in_session_json,true);
assert.equal(r130.qualification_totals.verified_plus_wholesale_upstreams,0);

// R131: advertised China VAT charge excludes Plus base ¥168 from ≤¥170; SMS is one-time without second receipt.
const r131a=d.records.find(x=>x.id==='gpt-source-followup-r131-20261111');
const r131b=d.records.find(x=>x.id==='gpt-source-followup-r131-20261111-evidence');
assert(r131a&&r131b&&r131a.url.endsWith('supplier-followup-20261111-r4.html'));
const r131=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-11/supplier-followup-20261111-r4-evidence.json'),'utf8'));
assert.equal(r131.round,131);assert.equal(r131.site_version,'1.9.139');assert.equal(r131.sources.length,8);
assert.equal(r131.new_evidence.gptpro5x.public_retail_base_price_cny_per_account_month,168);
assert.equal(r131.new_evidence.gptpro5x.base_plus_invoice_arithmetic_cny,178.08);
assert.equal(r131.new_evidence.gptpro5x.actual_paid_with_valid_china_vat_total_cny,null);
assert.equal(r131.new_evidence.codex_sms.public_price_per_one_time_verification_cny,10);
assert.equal(r131.new_evidence.codex_sms.merchant_claims_second_sms_supported,false);
assert.equal(r131.new_evidence.codex_sms.number_control_days_verified,null);
assert.equal(r131.qualification_totals.verified_plus_wholesale_upstreams,0);

// R132: invoice-option advertisement is not a valid China VAT invoice; agency fee cannot be ignored.
const r132a=d.records.find(x=>x.id==='gpt-source-followup-r132-20261111');
const r132b=d.records.find(x=>x.id==='gpt-source-followup-r132-20261111-evidence');
assert(r132a&&r132b&&r132a.url.endsWith('supplier-followup-20261111-r5.html'));
const r132=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-11/supplier-followup-20261111-r5-evidence.json'),'utf8'));
assert.equal(r132.round,132);assert.equal(r132.site_version,'1.9.140');assert.equal(r132.sources.length,9);
assert.equal(r132.new_evidence.aiplusgate.apple_invoice_option_advertised_total_cny,168);
assert.equal(r132.new_evidence.aiplusgate.actual_paid_with_valid_china_vat_total_cny,null);
assert.equal(r132.new_evidence.chatgqt_plus.agency_restock_precondition_fee_cny,3000);
assert.equal(r132.new_evidence.chatgqt_plus.agency_restock_fee_separate_from_goods_balance,true);
assert.equal(r132.qualification_totals.verified_plus_wholesale_upstreams,0);

const r133a=d.records.find(x=>x.id==='gpt-source-followup-r133-20261111');
const r133b=d.records.find(x=>x.id==='gpt-source-followup-r133-20261111-evidence');
assert(r133a&&r133b&&r133a.url.endsWith('supplier-followup-20261111-r6.html'));
const r133=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-11/supplier-followup-20261111-r6-evidence.json'),'utf8'));
assert.equal(r133.round,133);assert.equal(r133.site_version,'1.9.141');assert.equal(r133.sources.length,8);
assert.equal(r133.new_evidence.chatgptchongzhi.unpaid_checkout_preview_payable_cny,139);
assert.equal(r133.new_evidence.chatgptchongzhi.actual_paid_with_valid_china_vat_total_cny,null);
assert.equal(r133.new_evidence.chatgptchongzhi.merchant_receives_access_token_claim,true);
assert.equal(r133.qualification_totals.verified_plus_wholesale_upstreams,0);

// R134: distinguish ¥5 one-time Codex wallet credit from a successful SMS or cash refund; preserve BuyGPT displayed price conflict.
const r134a=d.records.find(x=>x.id==='gpt-source-followup-r134-20261111');
const r134b=d.records.find(x=>x.id==='gpt-source-followup-r134-20261111-evidence');
assert(r134a&&r134b&&r134a.url.endsWith('supplier-followup-20261111-r7.html'));
const r134=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-11/supplier-followup-20261111-r7-evidence.json'),'utf8'));
assert.equal(r134.round,134);assert.equal(r134.site_version,'1.9.142');assert.equal(r134.sources.length,11);
assert.equal(r134.new_evidence.ershuiai_codex_sms.public_price_cny_per_one_time_code,5);
assert.equal(r134.new_evidence.ershuiai_codex_sms.post_delivery_wallet_credit_days_claim,3);
assert.equal(r134.new_evidence.ershuiai_codex_sms.original_payment_cash_refund_verified,null);
assert.equal(r134.new_evidence.buygpt_plus.catalog_page_display_cny_per_account_month,149);
assert.equal(r134.new_evidence.buygpt_plus.product_page_promotion_display_cny_per_account_month,139);
assert.equal(r134.new_evidence.buygpt_plus.actual_paid_price_cny,null);
assert.equal(r134.qualification_totals.verified_plus_wholesale_upstreams,0);


// R135: seller-advertised new SKU and conditional refund fee are not successful paid fulfillment.
const r135a=d.records.find(x=>x.id==='gpt-source-followup-r135-20261111');
const r135b=d.records.find(x=>x.id==='gpt-source-followup-r135-20261111-evidence');
assert(r135a&&r135b&&r135a.url.endsWith('supplier-followup-20261111-r8.html'));
const r135=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-11/supplier-followup-20261111-r8-evidence.json'),'utf8'));
assert.equal(r135.round,135);assert.equal(r135.site_version,'1.9.143');assert.equal(r135.sources.length,2);
assert.equal(r135.new_evidence.yxab_sku_transition.historical_sku,'G69666080');
assert.equal(r135.new_evidence.yxab_sku_transition.new_sku,'G62975691');
assert.equal(r135.new_evidence.yxab_sku_transition.new_sku_public_price_cny_per_account_month,128.80);
assert.equal(r135.new_evidence.yxab_sku_transition.old_and_new_exact_same_product_or_stock_recovery_verified,null);
assert.equal(r135.new_evidence.yxab_sku_transition.merchant_claims_takes_fraction_of_openai_refunded_funds,0.20);
assert.equal(r135.new_evidence.yxab_sku_transition.checkout_payment_fee_cny,null);
assert.equal(r135.new_evidence.yxab_sku_transition.china_vat_invoice_fee_cny,null);
assert.equal(r135.new_evidence.yxab_sku_transition.formal_resale_authorization_verified,false);
assert.equal(r135.qualification_totals.verified_plus_wholesale_upstreams,0);

// R136: claimed API wholesaling is not VAT-verified lawful upstream; Session is required.
const r136a=d.records.find(x=>x.id==='gpt-source-followup-r136-20261111');
const r136b=d.records.find(x=>x.id==='gpt-source-followup-r136-20261111-evidence');
assert(r136a&&r136b&&r136a.url.endsWith('supplier-followup-20261111-r9.html'));
const r136=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-11/supplier-followup-20261111-r9-evidence.json'),'utf8'));
assert.equal(r136.round,136);assert.equal(r136.site_version,'1.9.144');assert.equal(r136.sources.length,11);
assert.equal(r136.new_evidence.aibulk.public_guest_lv1_display_price,17.99);
assert.equal(r136.new_evidence.aibulk.merchant_level_thresholds_usd_equivalent.Lv2,500);
assert.equal(r136.new_evidence.aibulk.actual_logged_in_level_specific_plus_wholesale_price,null);
assert.equal(r136.new_evidence.aibulk.session_json_required_for_redemption,true);
assert.equal(r136.new_evidence.aibulk.all_in_paid_valid_china_vat_cny,null);
assert.equal(r136.new_evidence.aibulk.formal_upstream_resale_authorization_verified,false);
assert.equal(r136.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r136.qualification_totals.verified_phone_sms_successes,0);


// R137: direct seller pages distinguish two-text 30-day SKU and two separate one-time SMS SKUs, no purchase/test.
const r137cat=d.records.find(x=>x.id==='gpt-source-followup-r137-20261111');
const r137data=d.records.find(x=>x.id==='gpt-source-followup-r137-20261111-evidence');
assert(r137cat&&r137data&&r137cat.url.endsWith('supplier-followup-20261111-r10.html'));
const r137=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-11/supplier-followup-20261111-r10-evidence.json'),'utf8'));
assert.equal(r137.round,137);assert.equal(r137.site_version,'1.9.145');assert.equal(r137.sources.length,8);
assert.equal(r137.new_evidence.goodshopit_plus.sku_page_prominent_price_cny,119);
assert.equal(r137.new_evidence.goodshopit_plus.sku_page_specification_price_cny_per_single_month,111);
assert.equal(r137.new_evidence.goodshopit_plus.actual_single_item_checkout_cny,null);
assert.equal(r137.new_evidence.goodshopit_plus.mainland_china_users_excluded_by_seller_notice,true);
assert.equal(r137.new_evidence.independent_sms.offers[0].listed_price_cny,6);
assert.equal(r137.new_evidence.independent_sms.offers[0].merchant_claim_max_sms,2);
assert.equal(r137.new_evidence.independent_sms.offers[0].merchant_claim_max_hours_from_activation,720);
assert.equal(r137.new_evidence.independent_sms.offers[0].ends_on_second_message_even_before_30_days,true);
assert.equal(r137.new_evidence.independent_sms.offers[1].listed_price_cny,3);
assert.equal(r137.new_evidence.independent_sms.offers[2].listed_price_cny,3);
assert.equal(r137.new_evidence.independent_sms.real_phone_sms_successes,0);
assert.equal(r137.qualification_totals.verified_plus_wholesale_upstreams,0);

// R138: unpaid fee breakdown and no lawful bulk purchase despite referral claims.
const r138cat=d.records.find(x=>x.id==='gpt-source-followup-r138-20261111');
const r138data=d.records.find(x=>x.id==='gpt-source-followup-r138-20261111-evidence');
assert(r138cat&&r138data&&r138cat.url.endsWith('supplier-followup-20261111-r11.html'));
const r138=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-11/supplier-followup-20261111-r11-evidence.json'),'utf8'));
assert.equal(r138.round,138);assert.equal(r138.site_version,'1.9.146');assert.equal(r138.sources.length,7);
assert.equal(r138.new_evidence.token5555.listed_product_subtotal_cny_per_item,148);
assert.equal(r138.new_evidence.token5555.listed_extra_payment_fee_cny,1.78);
assert.equal(r138.new_evidence.token5555.unpaid_checkout_preview_total_cny,149.78);
assert.equal(r138.new_evidence.token5555.merchant_old_terms_prohibit_reselling_codes,true);
assert.equal(r138.new_evidence.token5555.referral_is_verified_wholesale,false);
assert.equal(r138.new_evidence.token5555.all_required_fees_and_valid_china_vat_total_cny,null);
assert.equal(r138.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r138.qualification_totals.verified_phone_sms_successes,0);


// R139: short-lived SMS product, vendor delivery rate is not OpenAI success; official VoIP policy supersedes marketing.
const r139a=d.records.find(x=>x.id==='gpt-source-followup-r139-20261111');
const r139b=d.records.find(x=>x.id==='gpt-source-followup-r139-20261111-evidence');
assert(r139a&&r139b&&r139a.url.endsWith('supplier-followup-20261111-r12.html'));
const r139=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-11/supplier-followup-20261111-r12-evidence.json'),'utf8'));
assert.equal(r139.round,139);assert.equal(r139.site_version,'1.9.147');assert.equal(r139.sources.length,4);
assert.equal(r139.new_evidence.independent_sms_5sim.openai_category_table_start_from_usd_per_number,0.05);
assert.equal(r139.new_evidence.independent_sms_5sim.merchant_reported_best_sms_receipt_pct,46);
assert.equal(r139.new_evidence.independent_sms_5sim.merchant_claim_refund_is_cash_original_payment,false);
assert.equal(r139.new_evidence.independent_sms_5sim.sms_reverification_after_order_expiry,false);
assert.equal(r139.official_openai_reference.voip_numbers_not_supported,true);
assert.equal(r139.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r139.qualification_totals.verified_phone_sms_successes,0);

// R140: card/device ceiling is official policy, NOT proof of a specific paid vendor failure.
const r140a=d.records.find(x=>x.id==='gpt-source-followup-r140-20261111');
const r140b=d.records.find(x=>x.id==='gpt-source-followup-r140-20261111-evidence');
assert(r140a&&r140b&&r140a.url.endsWith('supplier-followup-20261111-r13.html'));
const r140=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-11/supplier-followup-20261111-r13-evidence.json'),'utf8'));
assert.equal(r140.round,140);assert.equal(r140.site_version,'1.9.148');assert.equal(r140.sources.length,1);
assert.equal(r140.new_evidence.official_card_and_device_limits.too_many_subscriptions_same_card_or_device_may_block_checkout,true);
assert.equal(r140.new_evidence.official_card_and_device_limits.device_limit_may_prevent_use_even_after_successful_purchase,true);
assert.equal(r140.new_evidence.official_card_and_device_limits.per_card_or_device_numeric_threshold_published,null);
assert.equal(r140.new_evidence.official_card_and_device_limits.merchant_specific_fulfillment_failure_verified,false);
assert.equal(r140.supply_reassessment.all_required_fees_with_valid_china_vat_total_cny,null);
assert.equal(r140.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r140.qualification_totals.verified_phone_sms_successes,0);


// R141: official mobile app-store account binding does not establish a seller failure or SMS bypass.
const r141a=d.records.find(x=>x.id==='gpt-source-followup-r141-20261111');
const r141b=d.records.find(x=>x.id==='gpt-source-followup-r141-20261111-evidence');
assert(r141a&&r141b&&r141a.url.endsWith('supplier-followup-20261111-r14.html'));
const r141=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-11/supplier-followup-20261111-r14-evidence.json'),'utf8'));
assert.equal(r141.round,141);assert.equal(r141.site_version,'1.9.149');assert.equal(r141.sources.length,1);
assert.equal(r141.new_evidence.official_mobile_subscription_binding.mobile_purchase_linked_to_store_account_and_chatgpt_account,true);
assert.equal(r141.new_evidence.official_mobile_subscription_binding.restore_purchases_transfers_to_another_chatgpt_account,false);
assert.equal(r141.new_evidence.official_mobile_subscription_binding.apple_account_previously_used_may_block_other_chatgpt_account_purchase_even_after_expiry,true);
assert.equal(r141.new_evidence.official_mobile_subscription_binding.google_play_account_previously_used_may_block_other_chatgpt_account_purchase_even_after_expiry,true);
assert.equal(r141.new_evidence.official_mobile_subscription_binding.apple_purchase_auto_binds_phone_number,false);
assert.equal(r141.new_evidence.official_mobile_subscription_binding.any_named_merchant_verified_to_have_hit_this_block,false);
assert.equal(r141.supply_reassessment.all_required_fees_with_valid_china_vat_total_cny,null);
assert.equal(r141.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r141.qualification_totals.verified_phone_sms_successes,0);

// R142: official Pro 200 open for new subscription is not third-party resale authorization.
const r142a=d.records.find(x=>x.id==='gpt-source-followup-r142-20261111');
const r142b=d.records.find(x=>x.id==='gpt-source-followup-r142-20261111-evidence');
assert(r142a&&r142b&&r142a.url.endsWith('supplier-followup-20261111-r15.html'));
const r142=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-11/supplier-followup-20261111-r15-evidence.json'),'utf8'));
assert.equal(r142.round,142);assert.equal(r142.site_version,'1.9.150');assert.equal(r142.sources.length,2);
assert.equal(r142.new_evidence.official_pro_tiers.pro_200_new_subscriptions_currently_available,true);
assert.equal(r142.new_evidence.official_pro_tiers.pro_500_usd_per_month,500);
assert.equal(r142.new_evidence.official_pro_tiers.named_merchant_delivery_or_authorization_verified,false);
assert.equal(r142.supply_reassessment.all_required_plus_fees_with_valid_china_vat_total_cny,null);
assert.equal(r142.qualification_totals.verified_plus_wholesale_upstreams,0);
const r143a=d.records.find(x=>x.id==='gpt-source-followup-r143-20261111'),r143b=d.records.find(x=>x.id==='gpt-source-followup-r143-20261111-evidence');
assert(r143a&&r143b&&r143a.url.endsWith('supplier-followup-20261111-r16.html'));
const r143=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-11/supplier-followup-20261111-r16-evidence.json'),'utf8'));
assert.equal(r143.round,143);assert.equal(r143.site_version,'1.9.151');assert.equal(r143.sources.length,2);
assert.equal(r143.new_evidence.official_apple_payment_recovery.apple_failed_renewal_automatically_cancels_subscription,false);
assert.equal(r143.new_evidence.official_apple_payment_recovery.parallel_web_or_google_subscription_may_duplicate_charges,true);
assert.equal(r143.new_evidence.official_apple_payment_recovery.separately_purchased_subscriptions_automatically_entitled_to_refund,false);
assert.equal(r143.supply_reassessment.all_required_plus_fees_with_valid_china_vat_total_cny,null);
assert.equal(r143.qualification_totals.verified_plus_wholesale_upstreams,0);

// R144: first-party Pro catalog labels are not checkout, wholesale, VAT or SMS evidence.
const r144a=d.records.find(x=>x.id==='gpt-source-followup-r144-20261111'),r144b=d.records.find(x=>x.id==='gpt-source-followup-r144-20261111-evidence');
assert(r144a&&r144b&&r144a.url.endsWith('supplier-followup-20261111-r17.html'));
const r144=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-11/supplier-followup-20261111-r17-evidence.json'),'utf8'));
assert.equal(r144.round,144);assert.equal(r144.site_version,'1.9.152');
assert.deepEqual(r144.new_evidence.chongpay.pro_products.map(x=>x.display_price_cny),[1188,3299]);
assert.equal(r144.new_evidence.chongpay.external_shop_readable,false);
assert.equal(r144.new_evidence.chongpay.all_fees_plus_including_valid_vat_cny,null);
assert.equal(r144.qualification_totals.verified_phone_sms_successes,0);

// R145: Plus account eligibility and official receipt provenance are newly sourced, not test purchases.
const r145a=d.records.find(x=>x.id==='gpt-source-followup-r145-20261111'),r145b=d.records.find(x=>x.id==='gpt-source-followup-r145-20261111-evidence');
assert(r145a&&r145b&&r145a.url.endsWith('supplier-followup-20261111-r18.html'));
const r145=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-11/supplier-followup-20261111-r18-evidence.json'),'utf8'));
assert.equal(r145.round,145);assert.equal(r145.site_version,'1.9.153');
assert.equal(r145.new_evidence.chongpay_account_eligibility.joined_team_disallowed,true);
assert.equal(r145.new_evidence.chongpay_account_eligibility.actual_checkout_total_cny,null);
assert.equal(r145.new_evidence.official_subscription_receipt_provenance.apple_google_store_purchase_invoice_appears_in_chatgpt_web_billing,false);
assert.equal(r145.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r145.qualification_totals.verified_phone_sms_successes,0);

// R147: eligible Pro API grants require actual claim; no automatic Codex API credits or supplier proof.
const r147a=d.records.find(x=>x.id==='gpt-source-followup-r147-20261111'),r147b=d.records.find(x=>x.id==='gpt-source-followup-r147-20261111-evidence');
assert(r147a&&r147b&&r147a.url.endsWith('supplier-followup-20261111-r20.html'));
const r147=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-11/supplier-followup-20261111-r20-evidence.json'),'utf8'));
assert.equal(r147.round,147);assert.equal(r147.site_version,'1.9.155');assert.equal(r147.sources.length,2);
assert.equal(r147.new_evidence.official_chatgpt_subscription_api_credit_benefit.required_paid_active_days_before_claim,7);
assert.equal(r147.new_evidence.official_chatgpt_subscription_api_credit_benefit.chatgpt_plus_ineligible,true);
assert.equal(r147.new_evidence.official_chatgpt_subscription_api_credit_benefit.codex_via_api_key_covered,false);
assert.equal(r147.new_evidence.official_chatgpt_subscription_api_credit_benefit.grant_automatically_issued_on_purchase,false);
assert.deepEqual(Object.values(r147.new_evidence.official_chatgpt_subscription_api_credit_benefit.eligible_pro_tiers_full_month_usd),[100,200,500]);
assert.equal(r147.new_evidence.getgpt_pro_current_catalog_claim.formal_upstream_resale_authorization_verified,false);
assert.equal(r147.new_evidence.getgpt_pro_current_catalog_claim.all_required_fees_cny,null);
assert.equal(r147.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r147.qualification_totals.verified_api_credit_grants_from_third_party_recharges,0);

// R148 merchant conditions are unverified and CATFK links do not prove a wholesale supply contract.
const r148a=d.records.find(x=>x.id==='gpt-source-followup-r148-20261112'),r148b=d.records.find(x=>x.id==='gpt-source-followup-r148-20261112-evidence');
assert(r148a&&r148b&&r148a.url.endsWith('supplier-followup-20261112.html'));
const r148=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-12/supplier-followup-20261112-evidence.json'),'utf8'));
assert.equal(r148.round,148);assert.equal(r148.site_version,'1.9.156');assert.equal(r148.sources.length,8);
assert.equal(r148.new_evidence.xiaojiu_account_prerequisites.no_prior_zero_amount_recharge_required,true);
assert.equal(r148.new_evidence.xiaojiu_account_prerequisites.all_in_plus_with_china_vat_cny,null);
assert.equal(r148.qualification_totals.verified_plus_wholesale_upstreams,0);

// R149: LinkAi retail listing, non-final payment preview and legal-entity draft never qualify as wholesale supply.
const r149a=d.records.find(x=>x.id==='gpt-source-followup-r149-20261112'),r149b=d.records.find(x=>x.id==='gpt-source-followup-r149-20261112-evidence');
assert(r149a&&r149b&&r149a.url.endsWith('supplier-followup-20261112-r2.html'));
const r149=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-12/supplier-followup-20261112-r2-evidence.json'),'utf8'));
assert.equal(r149.round,149);assert.equal(r149.site_version,'1.9.157');assert.equal(r149.sources.length,6);
assert.equal(r149.new_evidence.linkai_retail_plus_offer.listed_price_cny_per_30_days,150);
assert.equal(r149.new_evidence.linkai_retail_plus_offer.checkout_preview_payment_surcharge_cny,0);
assert.equal(r149.new_evidence.linkai_retail_plus_offer.all_in_plus_with_valid_china_vat_cny,null);
assert.equal(r149.new_evidence.linkai_merchant_contract_and_refund.terms_page_says_draft,true);
assert.equal(r149.new_evidence.linkai_supply_chain_and_api.formal_wholesale_or_openai_resale_authorization_verified,false);
assert.equal(r149.qualification_totals.verified_plus_wholesale_upstreams,0);

// R150: same-SKU V3 comparison and unverified payment/VAT/resale boundaries.
const r150a=d.records.find(x=>x.id==='gpt-source-followup-r150-20261112'),r150b=d.records.find(x=>x.id==='gpt-source-followup-r150-20261112-evidence');
assert(r150a&&r150b&&r150a.url.endsWith('supplier-followup-20261112-r3.html'));
const r150=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-12/supplier-followup-20261112-r3-evidence.json'),'utf8'));
assert.equal(r150.round,150);assert.equal(r150.site_version,'1.9.158');assert.equal(r150.sources.length,8);
assert.deepEqual(r150.new_evidence.v3_product_listing_comparison.map(x=>[x.prior_listing_cny,x.current_listing_cny,x.observed_listing_difference_cny]),[[135,133.5,-1.5],[145,143.5,-1.5]]);
assert.equal(r150.new_evidence.v3_payment_terms.wechat_displayed_percent_fee,3.5);
assert.equal(r150.new_evidence.v3_payment_terms.actual_total_including_valid_china_vat_cny,null);
assert.equal(r150.new_evidence.v3_resale_and_warranty.unauthorized_bulk_purchase_stockpiling_resale_restricted_by_merchant,true);
assert.equal(r150.qualification_totals.verified_plus_wholesale_upstreams,0);

// R153: Morimm separate Codex SMS listing and a Session-dependent Plus card redemption portal.
const r153cat=d.records.find(x=>x.id==='gpt-source-followup-r153-20261112');
const r153data=d.records.find(x=>x.id==='gpt-source-followup-r153-20261112-evidence');
assert(r153cat&&r153data&&r153cat.url.endsWith('supplier-followup-20261112-r6.html'));
const r153=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-12/supplier-followup-20261112-r6-evidence.json'),'utf8'));
assert.equal(r153.round,153);assert.equal(r153.site_version,'1.9.161');assert.equal(r153.sources.length,4);
assert.equal(r153.new_evidence.morimm_codex_once.historical_price_cny,3);
assert.equal(r153.new_evidence.morimm_codex_once.current_price_cny,4);
assert.equal(r153.new_evidence.morimm_codex_once.actual_payment_total_cny,null);
assert.equal(r153.new_evidence.morimm_codex_once.codex_sms_success_tested,false);
assert.equal(r153.new_evidence.morimm_plus_recheck.price_cny,114);
assert.equal(r153.new_evidence.morimm_plus_recheck.actual_paid_cny,null);
assert.equal(r153.new_evidence.redeem_portal.session_json_or_access_token_requested,true);
assert.equal(r153.new_evidence.redeem_portal.first_web_login_sms_can_be_bypassed,false);
assert.equal(r153.qualification_totals.verified_plus_wholesale_upstreams,0);

// R155: new SMS sources, not newly verified Plus wholesale.
const r155cat=d.records.find(x=>x.id==='gpt-source-followup-r155-20261112');
const r155data=d.records.find(x=>x.id==='gpt-source-followup-r155-20261112-evidence');
assert(r155cat&&r155data&&r155cat.url.endsWith('supplier-followup-20261112-r8.html'));
const r155=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-12/supplier-followup-20261112-r8-evidence.json'),'utf8'));
assert.equal(r155.round,155);assert.equal(r155.site_version,'1.9.163');assert.equal(r155.sources.length,5);
assert.deepEqual(r155.new_evidence.boaile_single_sms.offer_variants.map(x=>x.displayed_price_cny_per_voucher),[2.99,4.99]);
assert.equal(r155.new_evidence.boaile_single_sms.page_contains_payment_demo,true);
assert.equal(r155.new_evidence.boaile_single_sms.actual_number_retention_days,null);
assert.equal(r155.new_evidence.jiema91_long_rental.listing_price_cny,null);
assert.equal(r155.new_evidence.jiema91_long_rental.merchant_terms_paid_delivered_service_nonrefundable,true);
assert.equal(r155.new_evidence.official_phone_applicability.normal_chatgpt_registration_generally_requires_phone,false);
assert.equal(r155.qualification_totals.verified_plus_wholesale_upstreams,0);
// R156: static invoice arithmetic not paid total.
const r156cat=d.records.find(x=>x.id==='gpt-source-followup-r156-20261112');
const r156data=d.records.find(x=>x.id==='gpt-source-followup-r156-20261112-evidence');
assert(r156cat&&r156data&&r156cat.url.endsWith('supplier-followup-20261112-r9.html'));
const r156=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-12/supplier-followup-20261112-r9-evidence.json'),'utf8'));
assert.equal(r156.round,156);assert.equal(r156.site_version,'1.9.164');assert.equal(r156.sources.length,3);
assert.equal(r156.new_evidence.dunling_retail_plus.arithmetic_price_with_invoice_cny,164);
assert.equal(r156.new_evidence.dunling_retail_plus.real_invoiced_total_cny,null);
assert.equal(r156.qualification_totals.verified_plus_wholesale_upstreams,0);


// R157: precise public fee preview differs from actual tax-paid purchase.
const r157cat=d.records.find(x=>x.id==='gpt-source-followup-r157-20261112');
const r157data=d.records.find(x=>x.id==='gpt-source-followup-r157-20261112-evidence');
assert(r157cat&&r157data&&r157cat.url.endsWith('supplier-followup-20261112-r10.html'));
const r157=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-12/supplier-followup-20261112-r10-evidence.json'),'utf8'));
assert.equal(r157.round,157);assert.equal(r157.site_version,'1.9.165');assert.equal(r157.sources.length,6);
assert.equal(r157.new_evidence.catfk_aidp_xoyimh.displayed_listing_price_cny,117.46);
assert.equal(r157.new_evidence.catfk_aidp_xoyimh.displayed_wechat_preview_total_cny,120.75);
assert.equal(r157.new_evidence.catfk_aidp_xoyimh.displayed_wechat_fee_cny,3.29);
assert.equal(r157.new_evidence.catfk_aidp_xoyimh.all_required_invoiced_checkout_cny,null);
assert.equal(r157.new_evidence.wind89_guest_invoice_conflict.contradiction_unresolved,true);
assert.equal(r157.qualification_totals.verified_plus_wholesale_upstreams,0);

// R158: historical payment-option display versus current merchant checkout statement; no completed payment or VAT evidence.
const r158cat=d.records.find(x=>x.id==='gpt-source-followup-r158-20261112');
const r158data=d.records.find(x=>x.id==='gpt-source-followup-r158-20261112-evidence');
assert(r158cat&&r158data&&r158cat.url.endsWith('supplier-followup-20261112-r11.html'));
const r158=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-12/supplier-followup-20261112-r11-evidence.json'),'utf8'));
assert.equal(r158.round,158);assert.equal(r158.site_version,'1.9.166');assert.equal(r158.sources.length,4);
assert.equal(r158.new_evidence.payforgpt_sku7_payment_channel_comparison.displayed_price_cny_per_month_current,160);
assert.deepEqual(r158.new_evidence.payforgpt_sku7_payment_channel_comparison.previous_displayed_channels,['Alipay','WeChat Pay','USDT','manual bank transfer']);
assert.deepEqual(r158.new_evidence.payforgpt_sku7_payment_channel_comparison.current_merchant_named_channels,['Alipay','manual bank transfer']);
assert.equal(r158.new_evidence.payforgpt_sku7_payment_channel_comparison.merchant_now_explicit_wechat_payment_unavailable,true);
assert.equal(r158.new_evidence.payforgpt_sku7_payment_channel_comparison.usdt_service_formally_disabled_verified,null);
assert.equal(r158.new_evidence.payforgpt_sku7_payment_channel_comparison.all_required_fees_invoice_included_total_cny,null);
assert.equal(r158.qualification_totals.verified_plus_wholesale_upstreams,0);

// R159: same-seller, same-SKU 11/11 versus 11/12 public price snapshots only.
const r159cat=d.records.find(x=>x.id==='gpt-source-followup-r159-20261112');
const r159data=d.records.find(x=>x.id==='gpt-source-followup-r159-20261112-evidence');
assert(r159cat&&r159data&&r159cat.url.endsWith('supplier-followup-20261112-r12.html'));
const r159=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-12/supplier-followup-20261112-r12-evidence.json'),'utf8'));
assert.equal(r159.round,159);assert.equal(r159.site_version,'1.9.167');assert.equal(r159.sources.length,6);
const r159p=r159.new_evidence.chatgqt_plus_same_sku_price_snapshot_comparison;
assert.equal(r159p.no_warranty_previous_displayed_cny,125);assert.equal(r159p.no_warranty_current_displayed_cny,135);
assert.equal(r159p.warranty_previous_displayed_cny,135);assert.equal(r159p.warranty_current_displayed_cny,145);
assert.equal(r159p.no_warranty_snapshot_difference_cny,10);assert.equal(r159p.warranty_snapshot_difference_cny,10);
assert.equal(r159p.formal_price_change_effective_date,null);
assert.equal(r159p.wholesale_agent_entry_fee_cny,3000);assert.equal(r159p.wholesale_unit_price_cny,null);
assert.equal(r159p.actual_checkout_with_valid_china_vat_cny,null);
assert.equal(r159.qualification_totals.verified_plus_wholesale_upstreams,0);

// R160: XCY AI is a new retail observation; ten-unit "wholesale" cannot meet a single-unit requirement.
const r160cat=d.records.find(x=>x.id==='gpt-source-followup-r160-20261113');
const r160data=d.records.find(x=>x.id==='gpt-source-followup-r160-20261113-evidence');
assert(r160cat&&r160data&&r160cat.url.endsWith('supplier-followup-20261113.html'));
const r160=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-13/supplier-followup-20261113-evidence.json'),'utf8'));
assert.equal(r160.round,160);assert.equal(r160.site_version,'1.9.168');assert.equal(r160.sources.length,6);
assert.deepEqual(r160.new_evidence.original_account_plus_skus.map(x=>x.displayed_cny_per_account_month),[125,138]);
assert.equal(r160.new_evidence.wholesale.merchant_minimum_quantity,10);
assert.equal(r160.new_evidence.wholesale.merchant_displayed_bundle_total_cny,1130);
assert.equal(r160.new_evidence.wholesale.one_unit_wholesale_available_verified,false);
assert.equal(r160.new_evidence.invoice.invoice_issuer_entity,null);
assert.equal(r160.new_evidence.invoice.all_required_payment_and_invoice_fees_total_cny,null);
assert.equal(r160.new_evidence.independent_phone.holding_days,null);
assert.equal(r160.new_evidence.independent_phone.failed_sms_cash_refund,null);
assert.equal(r160.qualification_totals.verified_plus_wholesale_upstreams,0);

// R161: unpaid Plus checkout preview plus claimed invoice fee is not proven valid VAT or wholesale.
const r161cat=d.records.find(x=>x.id==='gpt-source-followup-r161-20261113');
const r161data=d.records.find(x=>x.id==='gpt-source-followup-r161-20261113-evidence');
assert(r161cat&&r161data&&r161cat.url.endsWith('supplier-followup-20261113-r2.html'));
const r161=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-13/supplier-followup-20261113-r2-evidence.json'),'utf8'));
assert.equal(r161.round,161);assert.equal(r161.site_version,'1.9.169');
assert.equal(r161.plus.checkout_preview_rounded_total_cny,112.04);
assert.equal(r161.plus.arithmetical_sum_checkout_preview_plus_invoice_claim_cny,162.04);
assert.equal(r161.plus.actual_paid_with_valid_china_vat_cny,null);
assert.equal(r161.invoice.invoice_verified,false);
assert.equal(r161.merchant.one_unit_wholesale_price_cny,null);
assert.equal(r161.sms.merchant_display_cny_per_code,6);
assert.equal(r161.sms.number_holding_days,null);
assert.equal(r161.qualification_totals.verified_plus_wholesale_upstreams,0);

// R162: new 52XUEAI retail item remains unqualified without valid Chinese VAT and resale evidence.
const r162cat=d.records.find(x=>x.id==='gpt-source-followup-r162-20261113');
const r162data=d.records.find(x=>x.id==='gpt-source-followup-r162-20261113-evidence');
assert(r162cat&&r162data&&r162cat.url.endsWith('supplier-followup-20261113-r3.html'));
const r162=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-13/supplier-followup-20261113-r3-evidence.json'),'utf8'));
assert.equal(r162.round,162);assert.equal(r162.site_version,'1.9.170');
assert.equal(r162.plus.sku,'G37392923');
assert.equal(r162.plus.merchant_display_cny_per_item_month,116);
assert.equal(r162.plus.unpaid_checkout_preview_payment_fee_cny,3.248);
assert.equal(r162.plus.unpaid_checkout_preview_total_cny,119.25);
assert.equal(r162.invoice.merchant_claim_invoice_fee_cny,null);
assert.equal(r162.invoice.actual_all_in_with_valid_china_vat_cny,null);
assert.equal(r162.merchant.one_unit_wholesale_price_cny,null);
assert.equal(r162.phone_verification.new_independent_sms_sku_found_this_round,false);
assert.equal(r162.qualification_totals.verified_plus_wholesale_upstreams,0);

// R164: two newly read retail products are not qualified wholesale or Chinese-VAT-paid purchases.
const r164cat=d.records.find(x=>x.id==='gpt-source-followup-r164-20261113');
const r164data=d.records.find(x=>x.id==='gpt-source-followup-r164-20261113-evidence');
assert(r164cat&&r164data&&r164cat.url.endsWith('supplier-followup-20261113-r5.html'));
const r164=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-13/supplier-followup-20261113-r5-evidence.json'),'utf8'));
assert.equal(r164.round,164);assert.equal(r164.site_version,'1.9.172');
assert.deepEqual(r164.candidates.map(x=>x.merchant_product_id),['G46459749','G64783075']);
assert.deepEqual(r164.candidates.map(x=>x.unpaid_checkout_preview_total_cny),[118.22,138.78]);
assert(r164.candidates.every(x=>x.merchant_workflow_requires_session_token===true&&x.actual_all_in_china_vat_cny===null));
assert(r164.candidates.every(x=>x.merchant_wholesale_one_unit_cost_cny===null&&x.china_vat_invoice_issuer_entity===null));
assert.equal(r164.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r164.qualification_totals.verified_real_plus_purchases,0);
assert.equal(r164.qualification_totals.verified_valid_china_vat_invoices,0);
assert.equal(r164.qualification_totals.verified_phone_sms_successes,0);

// R165: first-party 16688 item and SMS code; no invoice, wholesale, or SMS success proof.
const r165entry=d.records.find(x=>x.id==='gpt-source-followup-r165-20261113');
const r165evEntry=d.records.find(x=>x.id==='gpt-source-followup-r165-20261113-evidence');
assert(r165entry && r165evEntry && r165entry.url.endsWith('supplier-followup-20261113-r6.html'));
const r165=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-13/supplier-followup-20261113-r6-evidence.json'),'utf8'));
assert.equal(r165.round,165);assert.equal(r165.site_version,'1.9.173');
assert.equal(r165.plus_candidate.merchant_product_id,'G11162247');
assert.equal(r165.plus_candidate.display_price_cny_per_item_30days,108.49);
assert.equal(r165.plus_candidate.unpaid_checkout_preview_payment_fee_cny,3.0377);
assert.equal(r165.plus_candidate.unpaid_checkout_preview_total_cny,111.53);
assert.equal(r165.plus_candidate.china_vat_invoice_fee_cny,null);
assert.equal(r165.plus_candidate.actual_all_in_with_valid_china_vat_cny,null);
assert.equal(r165.plus_candidate.single_unit_wholesale_price_cny,null);
assert.equal(r165.independent_sms.merchant_product_id,'G88621777');
assert.equal(r165.independent_sms.display_price_cny_per_code,0.53);
assert.equal(r165.independent_sms.actual_number_holding_days,null);
assert.equal(r165.independent_sms.cash_refund_for_nonuser_sms_failure_verified,null);
assert(r165.qualification_totals.verified_plus_wholesale_upstreams===0);
assert(r165.qualification_totals.verified_real_plus_purchases===0);
assert(r165.qualification_totals.verified_valid_china_vat_invoices===0);
assert(r165.qualification_totals.verified_phone_sms_successes===0);


// R168: VirtualSMS is a first-party independent SMS retail observation, not verified Plus wholesale or cash-refunded SMS.
const r168cat=d.records.find(x=>x.id==='gpt-source-followup-r168-20261113');
const r168data=d.records.find(x=>x.id==='gpt-source-followup-r168-20261113-evidence');
assert(r168cat && r168data && r168cat.url.endsWith('supplier-followup-20261113-r9.html'));
const r168=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-13/supplier-followup-20261113-r9-evidence.json'),'utf8'));
assert.equal(r168.round,168);assert.equal(r168.site_version,'1.9.176');
assert.equal(r168.sources.length,6);
assert.equal(r168.independent_sms_candidate.merchant_displayed_country_starting_prices[0].price_usd_from,0.11);
assert.equal(r168.independent_sms_candidate.merchant_displayed_country_starting_prices[1].price_usd_from,0.13);
assert.equal(r168.independent_sms_candidate.merchant_displayed_country_starting_prices[4].price_usd_from,null);
assert.equal(r168.independent_sms_candidate.minimum_balance_topup_usd_from,2.5);
assert.equal(r168.independent_sms_candidate.minimum_card_topup_usd_from,5);
assert.equal(r168.independent_sms_candidate.no_sms_refund_destination,'nonwithdrawable platform balance; NOT original cash/crypto payment');
assert.equal(r168.independent_sms_candidate.actual_chosen_sku_checkout_price_usd,null);
assert.equal(r168.independent_sms_candidate.actual_openai_verification_success,false);
assert.equal(r168.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r168.qualification_totals.verified_phone_sms_successes,0);

// R169: CODASMS has a reseller application and API, not verified OpenAI SKU price, cash refund or Plus wholesale.
const r169cat=d.records.find(x=>x.id==='gpt-source-followup-r169-20261113');
const r169data=d.records.find(x=>x.id==='gpt-source-followup-r169-20261113-evidence');
assert(r169cat && r169data && r169cat.url.endsWith('supplier-followup-20261113-r10.html'));
const r169=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-13/supplier-followup-20261113-r10-evidence.json'),'utf8'));
assert.equal(r169.round,169);assert.equal(r169.site_version,'1.9.177');
assert.equal(r169.sources.length,7);
assert.equal(r169.independent_sms_reseller_candidate.exact_openai_service_code,null);
assert.equal(r169.independent_sms_reseller_candidate.exact_openai_single_sms_reseller_cost_usd,null);
assert.equal(r169.independent_sms_reseller_candidate.reseller_approval_required,true);
assert.equal(r169.independent_sms_reseller_candidate.written_resale_permission_required,true);
assert.equal(r169.independent_sms_reseller_candidate.minimum_initial_funding_usd,null);
assert.equal(r169.independent_sms_reseller_candidate.zero_upfront_fee_verified,false);
assert.equal(r169.independent_sms_reseller_candidate.independently_verified_nonvoip_sim,null);
assert.equal(r169.independent_sms_reseller_candidate.actual_cash_refund_verified,false);
assert.equal(r169.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r169.qualification_totals.verified_phone_sms_successes,0);

// R170: SNSOTP advertised SMS unit price must not be mistaken for paid one-code cash cost.
const r170cat=d.records.find(x=>x.id==='gpt-source-followup-r170-20261113');
const r170data=d.records.find(x=>x.id==='gpt-source-followup-r170-20261113-evidence');
assert(r170cat && r170data && r170cat.url.endsWith('supplier-followup-20261113-r11.html'));
const r170=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-13/supplier-followup-20261113-r11-evidence.json'),'utf8'));
assert.equal(r170.round,170);assert.equal(r170.site_version,'1.9.178');assert.equal(r170.sources.length,7);
assert.equal(r170.independent_sms_candidate.exact_service_code,'openai');
assert.equal(r170.independent_sms_candidate.merchant_public_prices_by_country.find(x=>x.country_code==='us').price_usd_per_one_sms_code,0.06);
assert.equal(r170.independent_sms_candidate.minimum_prepaid_crypto_topup_usd,40);
assert.equal(r170.independent_sms_candidate.merchant_stock_snapshot_as_of,'2026-11-04');
assert.equal(r170.independent_sms_candidate.prepaid_balance_withdrawable,false);
assert.equal(r170.independent_sms_candidate.actual_one_order_out_of_pocket_usd,null);
assert.equal(r170.independent_sms_candidate.verified_codex_desktop_sms_success,false);
assert.equal(r170.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r170.qualification_totals.verified_phone_sms_successes,0);

// R171: new retail quote and reseller API remain unverified for China VAT and official authorization.
const r171cat=d.records.find(x=>x.id==='gpt-source-followup-r171-20261113');
const r171dat=d.records.find(x=>x.id==='gpt-source-followup-r171-20261113-evidence');
assert(r171cat&&r171dat&&r171cat.url.endsWith('supplier-followup-20261113-r12.html'));
const r171=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-13/supplier-followup-20261113-r12-evidence.json'),'utf8'));
assert.equal(r171.round,171);assert.equal(r171.site_version,'1.9.179');assert.equal(r171.sources.length,10);
assert.equal(r171.new_plus_reseller_candidate.observed_lv1_price_usd_per_one_month_one_item,17.99);
assert.equal(r171.new_plus_reseller_candidate.actual_all_required_fees_and_valid_china_vat_cny,null);
assert.equal(r171.new_plus_reseller_candidate.formal_openai_supply_and_resale_authorization_verified,false);
assert.equal(r171.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r171.qualification_totals.verified_phone_sms_successes,0);

// R172: no misleading conversion of Free retail to Go upgrade/active Plus wholesale.
const r172cat=d.records.find(x=>x.id==='gpt-source-followup-r172-20261113');
const r172data=d.records.find(x=>x.id==='gpt-source-followup-r172-20261113-evidence');
assert(r172cat&&r172data&&r172cat.url.endsWith('supplier-followup-20261113-r13.html'));
const r172=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-13/supplier-followup-20261113-r13-evidence.json'),'utf8'));
assert.equal(r172.round,172);assert.equal(r172.site_version,'1.9.180');assert.equal(r172.sources.length,6);
assert.equal(r172.new_findings.free_to_plus_sku.advertised_lv1_usd_per_item_month,17.99);
assert.equal(r172.new_findings.go_to_plus_sku.advertised_lv1_usd_per_item_month,19.99);
assert.equal(r172.new_findings.go_to_plus_sku.remaining_go_days_preserved,false);
assert.equal(r172.new_findings.api_v170_change.nonfree_http_status,400);
assert.equal(r172.new_findings.earlier_renewal_change.same_tier_active_plus_http_status,409);
assert.equal(r172.new_findings.cost_and_authority.all_required_fees_and_valid_china_vat_cny,null);
assert.equal(r172.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r172.qualification_totals.verified_phone_sms_successes,0);

// R173: EVI guest USDT quote is not a legitimate single-item Chinese-VAT wholesale upstream.
const r173cat=d.records.find(x=>x.id==='gpt-source-followup-r173-20261114');
const r173data=d.records.find(x=>x.id==='gpt-source-followup-r173-20261114-evidence');
assert(r173cat&&r173data&&r173cat.url.endsWith('supplier-followup-20261114.html'));
const r173=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-14/supplier-followup-20261114-evidence.json'),'utf8'));
assert.equal(r173.round,173);assert.equal(r173.site_version,'1.9.181');assert.equal(r173.sources.length,7);
assert.equal(r173.new_retail_candidate.advertised_unit_price,16.8);
assert.equal(r173.new_retail_candidate.currency,'USDT');
assert.equal(r173.new_retail_candidate.session_token_required,true);
assert.equal(r173.new_retail_candidate.refund_to_site_balance_only_in_terms,true);
assert.equal(r173.new_retail_candidate.all_required_fees_with_valid_china_vat_cny,null);
assert.equal(r173.new_retail_candidate.qualified_upstream,false);
assert.equal(r173.qualification_totals.verified_plus_wholesale_upstreams,0);

// R174: OpenAI API first-key phone cap does not imply successful one-off rented SMS or paid subscription.
const r174cat=d.records.find(x=>x.id==='gpt-source-followup-r174-20261114');
const r174data=d.records.find(x=>x.id==='gpt-source-followup-r174-20261114-evidence');
assert(r174cat&&r174data&&r174cat.url.endsWith('supplier-followup-20261114-r2.html'));
const r174=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-14/supplier-followup-20261114-r2-evidence.json'),'utf8'));
assert.equal(r174.round,174);assert.equal(r174.site_version,'1.9.182');assert.equal(r174.sources.length,10);
assert.equal(r174.official_verification_findings.api_first_key_verification.phone_number_max_distinct_verified_accounts,3);
assert.equal(r174.official_verification_findings.api_first_key_verification.deleting_account_resets_api_phone_verification_quota,false);
assert.equal(r174.official_verification_findings.number_association.changing_or_updating_number_supported,false);
assert.equal(r174.official_verification_findings.phone_only_signup.plus_pro_business_require_verified_email,true);
assert.equal(r174.costs.new_all_required_fees_valid_china_vat_cny,null);
assert.equal(r174.qualification_totals.verified_plus_wholesale_upstreams,0);

// R175: consumer Plus authorization is distinct from business/API and Partner Network; no inference of merchant liability.
const r175cat=d.records.find(x=>x.id==='gpt-source-followup-r175-20261114');
const r175data=d.records.find(x=>x.id==='gpt-source-followup-r175-20261114-evidence');
assert(r175cat&&r175data&&r175cat.url.endsWith('supplier-followup-20261114-r3.html'));
const r175=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-14/supplier-followup-20261114-r3-evidence.json'),'utf8'));
assert.equal(r175.round,175);assert.equal(r175.site_version,'1.9.183');assert.equal(r175.sources.length,6);
assert.equal(r175.authorization_findings.consumer_terms.credentials_sharing_or_account_access_sharing_prohibited,true);
assert.equal(r175.authorization_findings.business_agreement.excludes_personal_consumer_subscription_by_default,true);
assert.equal(r175.authorization_findings.partner_network.seller_membership_or_consumer_plus_distribution_right_for_any_candidate_verified,false);
assert.equal(r175.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r175.costs.new_all_required_fees_valid_china_vat_cny,null);
assert.equal(r175.historical_prices_refreshed,false);

// R176: merchant phone-check bypass claims are not official policy or independent tests.
const r176cat=d.records.find(x=>x.id==='gpt-source-followup-r176-20261114');
const r176data=d.records.find(x=>x.id==='gpt-source-followup-r176-20261114-evidence');
assert(r176cat&&r176data&&r176cat.url.endsWith('supplier-followup-20261114-r4.html'));
const r176=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-14/supplier-followup-20261114-r4-evidence.json'),'utf8'));
assert.equal(r176.round,176);assert.equal(r176.site_version,'1.9.184');assert.equal(r176.sources.length,4);
assert.equal(r176.new_merchant.retail_plus.price_cny_per_listing,165);
assert.equal(r176.new_merchant.retail_plus.exact_paid_subscription_duration_from_this_sku,null);
assert.equal(r176.new_merchant.independent_sms.price_cny_per_listing,40);
assert.equal(r176.new_merchant.independent_sms.refund_on_no_sms_or_openai_rejection,null);
assert.equal(r176.official_verification_recheck.official_guarantees_plus_removes_all_phone_checks,false);
assert.equal(r176.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r176.qualification_totals.verified_phone_sms_successes,0);
assert.equal(r176.historical_prices_refreshed,false);

// R177: new SMS provider must not be conflated with Plus wholesale; mock checkout cannot qualify.
const r177cat=d.records.find(x=>x.id==='gpt-source-followup-r177-20261114');
const r177data=d.records.find(x=>x.id==='gpt-source-followup-r177-20261114-evidence');
assert(r177cat&&r177data&&r177cat.url.endsWith('supplier-followup-20261114-r5.html'));
const r177=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-14/supplier-followup-20261114-r5-evidence.json'),'utf8'));
assert.equal(r177.round,177);assert.equal(r177.site_version,'1.9.185');assert.equal(r177.sources.length,11);
assert.equal(r177.new_independent_sms_provider.minimum_wallet_funding_usd,10);
assert.equal(r177.new_independent_sms_provider.rates.united_states.price_usd_per_otp_session,0.45);
assert.equal(r177.new_independent_sms_provider.session_minutes,10);
assert.equal(r177.new_independent_sms_provider.no_sms_within_ten_minutes.refund_destination,'bot_wallet_balance');
assert.equal(r177.new_independent_sms_provider.fund_balance_cash_withdrawal_supported,null);
assert.equal(r177.new_supplier_screens[0].actual_real_payment_support_confirmed,false);
assert.equal(r177.new_supplier_screens[1].minimum_order_quantity,50);
assert.equal(r177.new_supplier_screens[1].user_original_account_supported,false);
assert.equal(r177.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r177.qualification_totals.verified_phone_sms_successes,0);
assert.equal(r177.historical_prices_refreshed,false);

 // R178: current merchant explicitly excludes valid China VAT; bulk quote is 10+ only, SMS refund remains a claim.
 const r178cat=d.records.find(x=>x.id==='gpt-source-followup-r178-20261114');
 const r178data=d.records.find(x=>x.id==='gpt-source-followup-r178-20261114-evidence');
 assert(r178cat&&r178data&&r178cat.url.endsWith('supplier-followup-20261114-r6.html'));
 const r178=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-14/supplier-followup-20261114-r6-evidence.json'),'utf8'));
 assert.equal(r178.round,178);assert.equal(r178.site_version,'1.9.186');
 assert.equal(r178.plus_supplier.wholesale_min_quantity,10);
 assert.equal(r178.plus_supplier.wholesale_price_usd_per_account,null);
 assert.equal(r178.plus_supplier.consumer_china_vat_invoice_available,false);
 assert.equal(r178.plus_supplier.enterprise_china_vat_invoice_available,false);
 assert.equal(r178.plus_supplier.all_required_fees_and_china_vat_invoice_included_cost_cny,null);
 assert.equal(r178.sms_service.display_price_usd_per_number,4.99);
 assert.equal(r178.sms_service.retain_days,21);
 assert.equal(r178.sms_service.merchant_claims_free_replacements_if_no_sms,2);
 assert.equal(r178.sms_service.merchant_claims_original_payment_refund_when_all_replacement_numbers_no_sms,true);
 assert.equal(r178.sms_service.independent_verified_original_payment_refund,false);
 assert.equal(r178.qualification_totals.verified_plus_wholesale_upstreams,0);
 assert.equal(r178.qualification_totals.verified_phone_sms_successes,0);
 assert.equal(r178.actual_purchase_or_sms_test_performed,false);

// R179: one-time OpenAI OTP terms are separate from Plus and 30-day number rental.
const r179cat=d.records.find(x=>x.id==='gpt-source-followup-r179-20261114');
const r179data=d.records.find(x=>x.id==='gpt-source-followup-r179-20261114-evidence');
assert(r179cat&&r179data&&r179cat.url.endsWith('supplier-followup-20261114-r7.html'));
const r179=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-14/supplier-followup-20261114-r7-evidence.json'),'utf8'));
assert.equal(r179.round,179);assert.equal(r179.site_version,'1.9.187');
assert.equal(r179.new_independent_sms_provider.retail_display_price_usd_per_one_otp,0.33);
assert.equal(r179.new_independent_sms_provider.actual_all_in_payment_cost_usd,null);
assert.equal(r179.new_independent_sms_provider.automatic_no_sms_refund_to,'nonwithdrawable_platform_wallet_balance');
assert.equal(r179.new_independent_sms_provider.terms_balance_redeemable_for_cash,false);
assert.equal(r179.new_independent_sms_provider.openai_month_rental_30_day_price_usd,null);
assert.equal(r179.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r179.qualification_totals.verified_phone_sms_successes,0);
assert.equal(r179.actual_purchase_or_sms_test_performed,false);
assert.equal(r179.historical_prices_refreshed,false);

// R180: this is a new retail listing with conflicting invoice wording, not a proven VAT-inclusive wholesale purchase.
const r180cat=d.records.find(x=>x.id==='gpt-source-followup-r180-20261114');
const r180data=d.records.find(x=>x.id==='gpt-source-followup-r180-20261114-evidence');
assert(r180cat&&r180data&&r180cat.url.endsWith('supplier-followup-20261114-r8.html'));
const r180=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-14/supplier-followup-20261114-r8-evidence.json'),'utf8'));
assert.equal(r180.round,180);assert.equal(r180.site_version,'1.9.188');
assert.equal(r180.new_retail_candidate.display_price_cny_per_30_days,149);
assert.equal(r180.new_retail_candidate.invoice_statement_conflict,true);
assert.equal(r180.new_retail_candidate.confirmed_valid_china_vat_invoice_available,null);
assert.equal(r180.new_retail_candidate.real_all_required_fees_invoice_included_cny,null);
assert.equal(r180.new_retail_candidate.session_token_required,true);
assert.equal(r180.new_retail_candidate.official_consumer_plus_distribution_authorization_verified,false);
assert.equal(r180.phone_verification_impact.guaranteed_sms_verification_or_phone_binding_from_plus_order,false);
assert.equal(r180.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r180.qualification_totals.verified_phone_sms_successes,0);
assert.equal(r180.actual_purchase_or_sms_test_performed,false);
assert.equal(r180.historical_prices_refreshed,false);

// R181: same yxab SKU stock-label transition is a merchant display, not a paid order, VAT or upstream qualification.
const r181entry=d.records.find(x=>x.id==='gpt-source-followup-r181-20261114');
const r181dataEntry=d.records.find(x=>x.id==='gpt-source-followup-r181-20261114-evidence');
assert(r181entry&&r181dataEntry&&r181entry.url.endsWith('supplier-followup-20261114-r9.html'));
const r181=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-14/supplier-followup-20261114-r9-evidence.json'),'utf8'));
assert.equal(r181.round,181);assert.equal(r181.site_version,'1.9.189');
assert.equal(r181.material_change.exact_sku_id,'G62975691');
assert.equal(r181.material_change.prior_merchant_stock_label,'有货');
assert.equal(r181.material_change.current_merchant_stock_label,'暂时缺货');
assert.equal(r181.material_change.current_display_price_cny_per_account_month,128.8);
assert.equal(r181.material_change.price_change_observed,false);
assert.equal(r181.material_change.checkout_payment_fee_cny,null);
assert.equal(r181.material_change.real_all_in_plus_china_vat_cost_cny,null);
assert.equal(r181.material_change.retailer_service_permanently_discontinued_verified,false);
assert.equal(r181.material_change.eligible_upstream_under_user_criteria,false);
assert.equal(r181.phone_verification.actual_sms_successes,0);
assert.equal(r181.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r181.actual_purchase_or_sms_test_performed,false);
assert.equal(r181.historical_126_prices_modified,false);

// R182: TopupCat new explicit no-invoice retailer, not wholesale, and differing exact iOS/Philippines SKUs.
const r182entry=d.records.find(x=>x.id==='gpt-source-followup-r182-20261114');
const r182dataEntry=d.records.find(x=>x.id==='gpt-source-followup-r182-20261114-evidence');
assert(r182entry&&r182dataEntry&&r182entry.url.endsWith('supplier-followup-20261114-r10.html'));
const r182=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-14/supplier-followup-20261114-r10-evidence.json'),'utf8'));
assert.equal(r182.round,182);assert.equal(r182.site_version,'1.9.190');
assert.deepEqual(r182.new_merchant.retail_skus.map(x=>x.display_price_cny_per_account_month),[149,159]);
assert.equal(r182.new_merchant.receipt_and_invoice.seller_claims_valid_china_vat_invoice,false);
assert.equal(r182.new_merchant.receipt_and_invoice.all_in_plus_with_valid_china_vat_cny,null);
assert.equal(r182.new_merchant.conflicting_eligibility_pages.conflict_requires_exact_checkout_sku_confirmation,true);
assert.equal(r182.new_merchant.operator_claim.address_same_in_both_domains,true);
assert.equal(r182.new_merchant.operator_claim.domain_control_or_contractual_operator_relationship_independently_verified,false);
assert.equal(r182.new_merchant.eligible_upstream_under_user_criteria,false);
assert.equal(r182.phone_verification.actual_sms_successes,0);
assert.equal(r182.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r182.historical_126_prices_modified,false);
assert.equal(r182.actual_purchase_or_sms_test_performed,false);

// R183: merchant invoice claims are not verified VAT and SMS rental labels are not proven OpenAI-compatible.
const r183entry=d.records.find(x=>x.id==='gpt-source-followup-r183-20261114');
const r183dataEntry=d.records.find(x=>x.id==='gpt-source-followup-r183-20261114-evidence');
assert(r183entry&&r183dataEntry&&r183entry.url.endsWith('supplier-followup-20261114-r11.html'));
const r183=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-14/supplier-followup-20261114-r11-evidence.json'),'utf8'));
assert.equal(r183.round,183);assert.equal(r183.site_version,'1.9.191');
assert.equal(r183.new_retail_candidate.listed_cny_per_month,140);
assert.equal(r183.new_retail_candidate.tax_invoice_claim.valid_china_vat_invoice_independently_verified,false);
assert.equal(r183.new_retail_candidate.total_cny_with_all_required_fees_and_valid_vat,null);
assert.equal(r183.new_retail_candidate.eligible_wholesale_under_user_criteria,false);
assert.equal(r183.sms_rental.sku_prices_whole_period_usd.gb.seven_days,0.98);
assert.equal(r183.sms_rental.sku_prices_whole_period_usd.us.one_day,4.4);
assert.equal(r183.sms_rental.sku_prices_whole_period_usd.us.three_days,null);
assert.equal(r183.sms_rental.refund_process.original_payment_method_guaranteed,false);
assert.equal(r183.sms_rental.openai_official_voip_numbers_not_supported,true);
assert.equal(r183.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r183.qualification_totals.verified_phone_sms_successes,0);
assert.equal(r183.historical_126_prices_modified,false);
assert.equal(r183.actual_purchase_or_sms_test_performed,false);


// R184: prepaid annual number rental is not US$1.80 billed monthly or verified OpenAI verification; failed activation credits wallet.
const r184entry=d.records.find(x=>x.id==='gpt-source-followup-r184-20261114');
const r184dataEntry=d.records.find(x=>x.id==='gpt-source-followup-r184-20261114-evidence');
assert(r184entry&&r184dataEntry&&r184entry.url.endsWith('supplier-followup-20261114-r12.html'));
const r184=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-14/supplier-followup-20261114-r12-evidence.json'),'utf8'));
assert.equal(r184.round,184);assert.equal(r184.site_version,'1.9.192');
assert.equal(r184.new_independent_phone_number_provider.display_price_usd_per_number_year,21.60);
assert.equal(r184.new_independent_phone_number_provider.effective_display_usd_per_month_if_annual_prepaid,1.80);
assert.equal(r184.new_independent_phone_number_provider.annual_payment_required,true);
assert.equal(r184.new_independent_phone_number_provider.one_month_sku_checkout_price_usd,null);
assert.equal(r184.new_independent_phone_number_provider.guarantee_merchant_claim.order_activation_failed,'automatically returns full amount to platform wallet');
assert.equal(r184.new_independent_phone_number_provider.guarantee_merchant_claim.refund_to_original_payment_guaranteed,false);
assert.equal(r184.new_independent_phone_number_provider.official_openai_verification_limits.phone_call_not_supported,true);
assert.equal(r184.new_independent_phone_number_provider.true_mobile_line_type_independently_verified,false);
assert.equal(r184.new_independent_phone_number_provider.tests.codex_desktop_sms_success,false);
assert.equal(r184.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r184.qualification_totals.verified_phone_sms_successes,0);
assert.equal(r184.historical_126_prices_modified,false);
assert.equal(r184.actual_purchase_or_sms_test_performed,false);

// R185: don't conflate own-account manual retail with dealer redemption card.
const entry185=d.records.find(x=>x.id==='gpt-source-followup-r185-20261114');
const data185=d.records.find(x=>x.id==='gpt-source-followup-r185-20261114-evidence');
assert(entry185&&data185&&entry185.url.endsWith('supplier-followup-20261114-r13.html'));
const r185=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-14/supplier-followup-20261114-r13-evidence.json'),'utf8'));
assert.equal(r185.round,185);assert.equal(r185.site_version,'1.9.193');
assert.equal(r185.new_candidate.retail.display_cny_per_own_account_month,115);
assert.equal(r185.new_candidate.wholesale_agent.agent_qualification_upfront_cny,20);
assert.equal(r185.new_candidate.wholesale_agent.agent_supplier_display_cny_per_undisclosed_unit,120);
assert.equal(r185.new_candidate.wholesale_agent.retail_sku_same_as_agent_sku_verified,false);
assert.equal(r185.new_candidate.full_all_fees_valid_china_vat_cny,null);
assert.equal(r185.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r185.actual_purchase_or_sms_test_performed,false);


// R186: do not promote old ¥168 article or conditional tax arithmetic into live payable wholesale prices.
const entry186=d.records.find(x=>x.id==='gpt-source-followup-r186-20261114');
const data186=d.records.find(x=>x.id==='gpt-source-followup-r186-20261114-evidence');
assert(entry186&&data186&&entry186.url.endsWith('supplier-followup-20261114-r14.html'));
const r186=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-14/supplier-followup-20261114-r14-evidence.json'),'utf8'));
assert.equal(r186.round,186);assert.equal(r186.site_version,'1.9.194');
assert.equal(r186.new_candidate.plus_sku.old_blog_base_cny_per_account_month,168);
assert.equal(r186.new_candidate.plus_sku.current_page_live_plus_price_cny,null);
assert.equal(r186.new_candidate.invoicing.homepage_extra_fee_rate_claim,.05);
assert.equal(r186.new_candidate.invoicing.old_blog_extra_fee_rate_claim,.06);
assert.equal(r186.new_candidate.invoicing.all_payment_fees_with_valid_china_vat_cny,null);
assert.equal(r186.new_candidate.credentials.conflicting_merchant_pages,true);
assert.equal(r186.new_candidate.qualified_wholesale,false);
assert.equal(r186.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r186.actual_purchase_or_sms_test_performed,false);

// R187: merchant statements, third-party price index, and no-SMS-success must remain separate.
const e187=d.records.find(x=>x.id==='gpt-source-followup-r187-20261114');
const ed187=d.records.find(x=>x.id==='gpt-source-followup-r187-20261114-evidence');
assert(e187&&ed187&&e187.url.endsWith('supplier-followup-20261114-r15.html'));
const r187=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-14/supplier-followup-20261114-r15-evidence.json'),'utf8'));
assert.equal(r187.round,187);assert.equal(r187.site_version,'1.9.195');
assert.equal(r187.independent_phone.number_control_period_minutes_merchant_claim,20);
assert.equal(r187.independent_phone.second_or_repeat_verification_supported_merchant_claim,false);
assert.equal(r187.independent_phone.direct_merchant_page_price_verified_cny,null);
assert.equal(r187.independent_phone.refund_to_original_payment_guaranteed,false);
assert.equal(r187.independent_phone.actual_sms_passed_tested,false);
assert.equal(r187.plus.existing_period_overwritten_not_accumulated_claim,true);
assert.equal(r187.plus.all_required_fees_valid_china_vat_cny,null);
assert.equal(r187.plus.eligible_qualified_upstream,false);
assert.equal(r187.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r187.qualification_totals.verified_phone_sms_successes,0);
assert.equal(r187.actual_purchase_or_sms_test_performed,false);
assert.equal(r187.historical_126_prices_modified,false);

// R188: public invoice fee floor is not proof of real-paid valid Chinese VAT or upstream rights.
const er188=d.records.find(x=>x.id==='gpt-source-followup-r188-20261114');
const edr188=d.records.find(x=>x.id==='gpt-source-followup-r188-20261114-evidence');
assert(er188&&edr188&&er188.url.endsWith('supplier-followup-20261114-r16.html'));
const dr188=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-14/supplier-followup-20261114-r16-evidence.json'),'utf8'));
assert.equal(dr188.round,188);assert.equal(dr188.site_version,'1.9.196');
assert.equal(dr188.new_retail_candidate.displayed_retail_price_cny_per_account_month,149);
assert.equal(dr188.new_retail_candidate.additional_invoice_fee_rule_merchant_claim.minimum_cny,15);
assert.equal(dr188.new_retail_candidate.plus_invoiced_derived_sum_conditional_cny,164);
assert.equal(dr188.new_retail_candidate.total_verified_with_valid_china_vat_cny,null);
assert.equal(dr188.new_retail_candidate.bona_fide_wholesale_verified,false);
assert.equal(dr188.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(dr188.actual_purchase_or_sms_test_performed,false);

// R189: personal USD invoice option is not an issued Chinese VAT invoice; enterprise minimum five excludes single unit.
const er189=d.records.find(x=>x.id==='gpt-source-followup-r189-20261114');
const ed189=d.records.find(x=>x.id==='gpt-source-followup-r189-20261114-evidence');
assert(er189&&ed189&&er189.url.endsWith('supplier-followup-20261114-r17.html'));
const r189=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-14/supplier-followup-20261114-r17-evidence.json'),'utf8'));
assert.equal(r189.round,189);assert.equal(r189.site_version,'1.9.197');
assert.equal(r189.candidate.displayed_base_usd_per_account_month,22.14);
assert.equal(r189.candidate.merchant_invoice_option_extra_usd,2.10);
assert.equal(r189.candidate.derived_usd_total_with_invoice_option,24.24);
assert.equal(r189.candidate.enterprise_minimum_quantity_claim,5);
assert.equal(r189.candidate.merchant_terms_excludes_actual_mainland_china_users,true);
assert.equal(r189.candidate.invoice_valid_china_vat_verified,false);
assert.equal(r189.candidate.complete_actual_china_vat_cny,null);
assert.equal(r189.candidate.is_qualified_verified_wholesale_upstream,false);
assert.equal(r189.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r189.actual_purchase_or_sms_test_performed,false);

// R191: seller-controlled retail evidence is not verified wholesale or VAT.
const r191new=d.records.find(x=>x.id==='gpt-source-followup-r191-20261115');
assert(r191new&&r191new.url.endsWith('supplier-followup-20261115.html'));
const evidence191=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-15/supplier-followup-20261115-evidence.json'),'utf8'));
assert.equal(evidence191.round,191);assert.equal(evidence191.candidate.advertised_price_cny_per_account_month,129);
assert.equal(evidence191.candidate.wholesale_unit_cost_cny,null);assert.equal(evidence191.candidate.actual_all_fees_with_valid_china_vat_cny,null);
assert.equal(evidence191.candidate.china_vat_invoice_verified,false);assert.equal(evidence191.seller_controlled_metrics.independent_audit,false);
assert.equal(evidence191.qualification_totals.verified_plus_wholesale_upstreams,0);


// R193: exact variant price is not the new-account price, VAT claims are not a paid invoice or wholesale.
const er193=d.records.find(x=>x.id==='gpt-source-followup-r193-20261115');
const ed193=d.records.find(x=>x.id==='gpt-source-followup-r193-20261115-evidence');
assert(er193&&ed193&&er193.url.endsWith('supplier-followup-20261115-r3.html'));
const r193=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-15/supplier-followup-20261115-r3-evidence.json'),'utf8'));
assert.equal(r193.round,193);assert.equal(r193.site_version,'1.9.201');
assert.deepEqual(r193.new_retail_candidates.map(x=>x.original_account_one_month_advertised_cny),[150,148,128]);
assert.equal(r193.new_retail_candidates[0].exact_original_account_variant_id,'1850');
assert.equal(r193.new_retail_candidates[0].other_new_account_variant_id,'1852');
assert.equal(r193.new_retail_candidates[0].valid_china_vat_total_paid_cny,null);
assert.equal(r193.new_retail_candidates[1].actual_paid_with_valid_china_vat_cny,null);
assert.equal(r193.new_retail_candidates[2].all_required_fees_with_valid_china_vat_cny,null);
assert.equal(r193.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r193.qualification_totals.verified_phone_sms_successes,0);
assert.equal(r193.actual_purchase_or_contact_or_credentials_or_sms_test_performed,false);

// R194: technical partner API does not establish one-unit wholesale price or VAT.
const er194=d.records.find(x=>x.id==='gpt-source-followup-r194-20261115'),ed194=d.records.find(x=>x.id==='gpt-source-followup-r194-20261115-evidence');
assert(er194&&ed194&&er194.url.endsWith('supplier-followup-20261115-r4.html'));
const r194=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-15/supplier-followup-20261115-r4-evidence.json'),'utf8'));
assert.equal(r194.round,194);assert.equal(r194.site_version,'1.9.202');
assert.equal(r194.new_wholesale_system_candidate.partner_api.order_debits_real_balance,true);
assert.equal(r194.new_wholesale_system_candidate.partner_api.one_unit_plus_purchase_eligible_verified,false);
assert.equal(r194.new_wholesale_system_candidate.current_live_wholesale_one_unit_cny,null);
assert.equal(r194.new_wholesale_system_candidate.valid_china_vat_invoice_total_cny,null);
assert.equal(r194.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r194.qualification_totals.verified_phone_sms_successes,0);

// R195: quantity tier, stale index, invoice and SMS assertions.
const er195=d.records.find(x=>x.id==='gpt-source-followup-r195-20261115'),ed195=d.records.find(x=>x.id==='gpt-source-followup-r195-20261115-evidence');
assert(er195&&ed195&&er195.url.endsWith('supplier-followup-20261115-r5.html'));
const r195=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-15/supplier-followup-20261115-r5-evidence.json'),'utf8'));
assert.equal(r195.round,195);assert.equal(r195.site_version,'1.9.203');
assert.equal(r195.new_public_tier_candidate.wholesale_tier_min_quantity,10);
assert.equal(r195.new_public_tier_candidate.wholesale_tier_eligible_single_unit,false);
assert.equal(r195.new_public_tier_candidate.valid_china_vat_invoice_total_cny,null);
assert.equal(r195.yunshu_plus_0006.direct_server_message,'该商品暂未上架');
assert.equal(r195.yunshu_plus_0006.index_price_verified_current,false);
assert.equal(r195.yunshu_plus_0006.current_live_plus_price_cny,null);
assert.equal(r195.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r195.qualification_totals.verified_phone_sms_successes,0);
assert.equal(r195.actual_purchase_or_contact_or_credentials_or_sms_test_performed,false);

// R196: distinct public brands are one claimed operator, and Codex points are not a phone/SMS SKU.
const e196=d.records.find(x=>x.id==='gpt-source-followup-r196-20261115'),ed196=d.records.find(x=>x.id==='gpt-source-followup-r196-20261115-evidence');
assert(e196&&ed196&&e196.url.endsWith('supplier-followup-20261115-r6.html'));
const r196=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-15/supplier-followup-20261115-r6-evidence.json'),'utf8'));
const group196=r196.new_vendor_group;
assert.equal(r196.round,196);assert.equal(r196.site_version,'1.9.204');
assert.equal(group196.declared_operator,'ClyGen Inc');assert.equal(group196.brands.length,2);
assert.equal(group196.independently_verified_wholesale_upstreams,0);
assert.deepEqual(group196.brands.map(x=>x.price_cny_per_account_month),[155,155]);
assert.deepEqual(group196.brands.map(x=>x.codex_250_credits_price_cny_per_topup),[82,85]);
assert(group196.brands.every(x=>x.codex_credits_are_phone_service===false && x.valid_china_vat_total_cny===null));
assert.equal(group196.partner_program.public_single_unit_wholesale_cny,null);
assert.equal(group196.api.bulk_purchase_quote_documented,false);
assert.equal(r196.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r196.qualification_totals.verified_phone_sms_successes,0);
assert.equal(r196.actual_purchase_or_contact_or_credentials_or_sms_test_performed,false);

// R197: independent corporate verification and VAT must not be inferred from same-name brand privacy policies.
const e197=d.records.find(x=>x.id==='gpt-source-followup-r197-20261115'),ed197=d.records.find(x=>x.id==='gpt-source-followup-r197-20261115-evidence');
assert(e197&&ed197&&e197.url.endsWith('supplier-followup-20261115-r7.html'));
const r197=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-15/supplier-followup-20261115-r7-evidence.json'),'utf8'));
assert.equal(r197.round,197); assert.equal(r197.site_version,'1.9.205');
assert.equal(r197.new_evidence.operator_group.brands_self_claimed_same_operator_count,3);
assert.equal(r197.new_evidence.abcnum_plus.price_cny_per_account_month,170);
assert.equal(r197.new_evidence.abcnum_plus.all_in_with_valid_china_vat_invoice_cny,null);
assert.equal(r197.new_evidence.session_handling.merchant_claim_required_credentials_may_be_shared_with_actual_fulfiller,true);
assert.equal(r197.new_evidence.session_handling.query_exception_applies_to_recharge_orders,false);
assert.equal(r197.new_evidence.operator_site.independently_verified_business_registration,false);
assert.equal(r197.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r197.qualification_totals.verified_phone_sms_successes,0);
assert.equal(r197.actual_purchase_or_contact_or_credentials_or_sms_test_performed,false);

// R198: new first-party indexed brands do not imply actual wholesale or valid VAT invoice.
const e198=d.records.find(x=>x.id==='gpt-source-followup-r198-20261115'),ed198=d.records.find(x=>x.id==='gpt-source-followup-r198-20261115-evidence');
assert(e198&&ed198&&e198.url.endsWith('supplier-followup-20261115-r8.html'));
const r198=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-15/supplier-followup-20261115-r8-evidence.json'),'utf8'));
assert.equal(r198.round,198);assert.equal(r198.site_version,'1.9.206');
assert.equal(r198.operator_group.count_brand_self_claims,5);
assert.deepEqual(r198.indexed_retail_candidates.map(x=>x.indexed_price_cny_per_recharge),[149,148]);
assert(r198.indexed_retail_candidates.every(x=>x.accurate_months===null&&x.price_live_verified===false&&x.valid_china_vat_invoice_total_cny===null));
assert.equal(r198.contract_name_discrepancy.privacy_heading,'GETAIAI Privacy Policy');
assert.equal(r198.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r198.qualification_totals.verified_phone_sms_successes,0);
assert.equal(r198.paid_invoice_or_sms_test_done,false);


// R199: merchant retail price is not a paid VAT-inclusive wholesale quote; three-month SKU stays separate.
const e199=d.records.find(x=>x.id==='gpt-source-followup-r199-20261115'),ed199=d.records.find(x=>x.id==='gpt-source-followup-r199-20261115-evidence');
assert(e199&&ed199&&e199.url.endsWith('supplier-followup-20261115-r9.html'));
const r199=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-15/supplier-followup-20261115-r9-evidence.json'),'utf8'));
assert.equal(r199.round,199);assert.equal(r199.site_version,'1.9.207');
assert.equal(r199.new_retail_candidate.advertised_price_cny_per_account_month,135);
assert.equal(r199.new_retail_candidate.actual_paid_with_valid_chinese_vat_total_cny,null);
assert.equal(r199.new_retail_candidate.wholesale_one_unit_price_cny,null);
assert.equal(r199.new_retail_candidate.valid_chinese_vat_invoice_available_verified,false);
assert.equal(r199.separate_nonqualifying_product.advertised_price_cny_per_three_month_package,390);
assert.equal(r199.separate_nonqualifying_product.not_one_unit_one_month,true);
assert.equal(r199.seller_privacy.seller_claims_may_store_task_output_screenshot_screen_recording,true);
assert.equal(r199.seller_privacy.actual_breach_evidence,false);
assert.equal(r199.phone.real_sms_successes,0);
assert.equal(r199.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r199.payment_done,false);assert.equal(r199.credentials_submitted,false);

// R200: merchant low-success warning, noncash SMS refund and separate SKU pricing are claims, not real tests.
const e200=d.records.find(x=>x.id==='gpt-source-followup-r200-20261115'),ed200=d.records.find(x=>x.id==='gpt-source-followup-r200-20261115-evidence');
assert(e200&&ed200&&e200.url.endsWith('supplier-followup-20261115-r10.html'));
const r200=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-15/supplier-followup-20261115-r10-evidence.json'),'utf8'));
assert.equal(r200.round,200);assert.equal(r200.site_version,'1.9.208');
assert.deepEqual(r200.distinct_services.map(x=>[x.id,x.seller_advertised_price_cny_per_one_sms??x.starting_price_cny_per_single_sms]),[['bigolab-us-physical-codex-10',15],['bigolab-random-region-codex-28',8],['bigolab-openai-generic-jiema',6]]);
assert.equal(r200.distinct_services[0].seller_own_current_low_success_warning,true);
assert.equal(r200.distinct_services[0].warning_first_effective_date,null);
assert.equal(r200.distinct_services[1].guaranteed_thailand_country,false);
assert.equal(r200.distinct_services[2].original_payment_refund_on_no_sms,false);
assert.equal(r200.distinct_services[2].number_validity_minutes,20);
assert.equal(r200.distinct_services[2].actual_total_cny,null);
assert.equal(r200.distinct_services[0].invoice_and_payment_all_in_actual_cny,null);
assert.equal(r200.distinct_services[1].invoice_and_payment_all_in_actual_cny,null);
assert.equal(r200.distinct_services[2].no_sms_refund_destination,'nonwithdrawable website balance, including QR payment portion');
assert.equal(r200.getgpt_pro_phone_followup.seller_own_uncontrolled_feedback_over_95_percent_claim,true);
assert.equal(r200.getgpt_pro_phone_followup.independent_sample_size,null);
assert.equal(r200.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r200.qualification_totals.real_phone_sms_successes,0);
assert.equal(r200.payment_done,false);assert.equal(r200.seller_contacted,false);

// R201: merchant advertised zero ordinary VAT surcharge is not proof of real tax invoice or true upstream.
const e201=d.records.find(x=>x.id==='gpt-source-followup-r201-20261115'),ed201=d.records.find(x=>x.id==='gpt-source-followup-r201-20261115-evidence');
assert(e201&&ed201&&e201.url.endsWith('supplier-followup-20261115-r11.html'));
const r201=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-15/supplier-followup-20261115-r11-evidence.json'),'utf8'));
assert.equal(r201.round,201);assert.equal(r201.site_version,'1.9.209');
assert.equal(r201.plus_sku.advertised_retail_cny_per_account_month,160);
assert.equal(r201.plus_sku.claimed_ordinary_vat_additional_cny,0);
assert.equal(r201.plus_sku.actual_all_fees_with_valid_china_vat_cny,null);
assert.equal(r201.invoice_policy.retail_special_vat_additional_rate,null);
assert.equal(r201.invoice_policy.issued_valid_chinese_vat_invoice_tested,false);
assert.equal(r201.other_not_plus_offer.minimum_qty,5);
assert.equal(r201.other_not_plus_offer.not_plus,true);
assert.equal(r201.upstream.plus_wholesale_one_unit_price_cny,null);
assert.equal(r201.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r201.qualification_totals.real_phone_sms_successes,0);
assert.equal(r201.payment_done,false);assert.equal(r201.seller_contacted,false);

// R202: a third-party recharge implementation and iOS CDK session prerequisites do not prove a supply or SMS success.
const e202=d.records.find(x=>x.id==='gpt-source-followup-r202-20261115'),ed202=d.records.find(x=>x.id==='gpt-source-followup-r202-20261115-evidence');
assert(e202&&ed202&&e202.url.endsWith('supplier-followup-20261115-r12.html'));
const r202=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-15/supplier-followup-20261115-r12-evidence.json'),'utf8'));
assert.equal(r202.round,202);assert.equal(r202.site_version,'1.9.210');
assert.equal(r202.technical_candidate.qualified_as_upstream,false);
assert.equal(r202.technical_candidate.exact_public_plus_single_month_product_sku,null);
assert.equal(r202.technical_candidate.real_one_unit_wholesale_plus_price_cny,null);
assert.equal(r202.technical_candidate.all_required_fees_with_valid_chinese_vat_cny,null);
assert.equal(r202.technical_candidate.two_hosts_same_actual_service_verified,false);
assert.equal(r202.technical_candidate.purchase_endpoints_operational_live_tested,false);
assert.equal(r202.new_delivery_interface_observations.length,2);
assert(r202.new_delivery_interface_observations.every(x=>x.prior_login_required===true&&x.actual_fulfillment_verified===false));
assert.equal(r202.independent_phone.real_sms_successes,0);
assert.equal(r202.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r202.payment_done,false);assert.equal(r202.credentials_submitted,false);

// R203: a current retail Plus+Alipay preview cannot pass a required China VAT invoice or no-agent-fee wholesale test.
const e203=d.records.find(x=>x.id==='gpt-source-followup-r203-20261115'),ed203=d.records.find(x=>x.id==='gpt-source-followup-r203-20261115-evidence');
assert(e203&&ed203&&e203.url.endsWith('supplier-followup-20261115-r13.html'));
const r203=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-15/supplier-followup-20261115-r13-evidence.json'),'utf8'));
assert.equal(r203.round,203);assert.equal(r203.site_version,'1.9.211');
assert.equal(r203.plus.retail_card.advertised_cny,107);
assert.equal(r203.plus.retail_card.alipay_unpaid_preview_total_cny,113.42);
assert.equal(r203.plus.retail_card.all_required_fees_with_valid_chinese_vat_cny,null);
assert.equal(r203.plus.ios.advertised_current_product_and_price_sheet_cny,133);
assert.equal(r203.plus.ios.faq_conflicting_advertised_cny,130);
assert.equal(r203.seller.valid_chinese_vat_invoice_offered_by_merchant,false);
assert.equal(r203.agent.paid_agent_qualification_cny,99);
assert.equal(r203.agent.merchant_claimed_free_qualification_after_valid_purchase_or_referral_sales_cny,2000);
assert.equal(r203.independent_sms.advertised_cny_per_number,12);
assert.equal(r203.independent_sms.alipay_unpaid_preview_total_cny,12.72);
assert.equal(r203.independent_sms.warranty_first_successful_codex_binding_hours,24);
assert.equal(r203.independent_sms.number_claimed_repeated_sms_window_days_max,80);
assert.equal(r203.independent_sms.real_successful_sms_bindings,0);
assert.equal(r203.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r203.payment_done,false);assert.equal(r203.credentials_submitted,false);

// R204: retail arithmetic below the ceiling is not proof of all-fee VAT purchase or real wholesale authorization.
const e204=d.records.find(x=>x.id==='gpt-source-followup-r204-20261115'),ed204=d.records.find(x=>x.id==='gpt-source-followup-r204-20261115-evidence');
assert(e204&&ed204&&e204.url.endsWith('supplier-followup-20261115-r14.html'));
const r204=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-15/supplier-followup-20261115-r14-evidence.json'),'utf8'));
assert.equal(r204.round,204);assert.equal(r204.site_version,'1.9.212');
assert.equal(r204.plus.merchant_listed_cny_per_account_month,158);
assert.equal(r204.plus.merchant_claimed_ordinary_vat_surcharge_rate,0.06);
assert.equal(r204.plus.merchant_listing_plus_vat_arithmetic_cny,167.48);
assert.equal(r204.plus.all_required_fees_with_valid_chinese_vat_cny,null);
assert.equal(r204.plus.min_retail_quantity_independently_verified,null);
assert.equal(r204.plus.real_one_unit_wholesale_price_cny,null);
assert.equal(r204.seller.wholesale_resale_authorization_verified,false);
assert.equal(r204.credentials_and_delivery.actual_sessionless_checkout_and_delivery_tested,false);
assert.equal(r204.independent_phone.real_sms_successes,0);
assert.equal(r204.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r204.payment_done,false);assert.equal(r204.credentials_submitted,false);

// R205: a reseller's outbound checkout link and advertisement starting price do not establish an all-in China VAT wholesale price.
const e205=d.records.find(x=>x.id==='gpt-source-followup-r205-20261115'),ed205=d.records.find(x=>x.id==='gpt-source-followup-r205-20261115-evidence');
assert(e205&&ed205&&e205.url.endsWith('supplier-followup-20261115-r15.html'));
const r205=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-15/supplier-followup-20261115-r15-evidence.json'),'utf8'));
assert.equal(r205.round,205);assert.equal(r205.site_version,'1.9.213');
assert.equal(r205.plus.advertised_starting_cny_per_month,165);
assert.equal(r205.plus.min_conditional_advertising_arithmetic_cny,168.30);
assert.equal(r205.plus.max_conditional_advertising_arithmetic_cny,173.25);
assert.equal(r205.plus.verified_valid_china_vat_all_in_cny,null);
assert.equal(r205.cross_domain.plus_self_service_order_link,'https://qfcc99.com/shop/panghu');
assert.equal(r205.cross_domain.common_operator_verified,false);
assert.equal(r205.plus.single_unit_monthly_checkout_sku_verified,false);
assert.equal(r205.merchant.formal_resale_authorization_verified,false);
assert.equal(r205.independent_phone.real_sms_successes,0);
assert.equal(r205.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r205.payment_done,false);assert.equal(r205.credentials_submitted,false);

// R206: a new merchant listing, unpaid payment preview or older third-party SMS snapshot is not verified VAT wholesale.
const e206=d.records.find(x=>x.id==='gpt-source-followup-r206-20261115'),ed206=d.records.find(x=>x.id==='gpt-source-followup-r206-20261115-evidence');
assert(e206&&ed206&&e206.url.endsWith('supplier-followup-20261115-r16.html'));
const r206=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-15/supplier-followup-20261115-r16-evidence.json'),'utf8'));
assert.equal(r206.round,206);assert.equal(r206.site_version,'1.9.214');
assert.equal(r206.new_evidence.chongpay.advertised_cny_per_item,139);
assert.equal(r206.new_evidence.chongpay.identical_sku_price_cut_verified,false);
assert.equal(r206.new_evidence.chongpay.valid_china_vat_invoice_all_in_cny,null);
assert.equal(r206.new_evidence.token5555.checkout_single_item_subtotal_cny,148);
assert.equal(r206.new_evidence.token5555.payment_surcharge_cny,1.78);
assert.equal(r206.new_evidence.token5555.checkout_displayed_unpaid_total_cny,149.78);
assert.equal(r206.new_evidence.token5555.valid_china_vat_invoice_all_in_cny,null);
assert.equal(r206.new_evidence.catfk.first_party_readable,false);
assert.equal(r206.new_evidence.catfk.sku_quotes.length,3);
assert.equal(r206.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r206.payment_done,false);assert.equal(r206.credentials_submitted,false);

// R207: first-party SKU price and stock, third-party availability mismatch, and VAT minimum threshold.
const cr207=d.records.find(x=>x.id==='gpt-source-followup-r207-20261115');
const edr207=d.records.find(x=>x.id==='gpt-source-followup-r207-20261115-evidence');
assert(cr207&&edr207&&cr207.url.endsWith('supplier-followup-20261115-r17.html'));
const r207=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-15/supplier-followup-20261115-r17-evidence.json'),'utf8'));
assert.equal(r207.round,207);assert.equal(r207.site_version,'1.9.215');
assert.equal(r207.new_evidence.ai_access_hub.previous_listing_cny_per_one_month_card,130);
assert.equal(r207.new_evidence.ai_access_hub.current_listing_cny_per_one_month_card,135);
assert.equal(r207.new_evidence.ai_access_hub.actual_available_inventory_verified,false);
assert.equal(r207.new_evidence.zhang_hao_shang.first_party_direct_response.msg,'This product is not on sale yet');
assert.equal(r207.new_evidence.zhang_hao_shang.first_party_current_accurate_price_cny,null);
assert.equal(r207.new_evidence.moreai.merchant_claimed_china_ordinary_vat_invoice_minimum_spend_cny,200);
assert.equal(r207.new_evidence.moreai.all_fees_valid_china_vat_cny,null);
assert.equal(r207.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r207.payment_done,false);assert.equal(r207.credentials_submitted,false);


// R208: a usable SMS access link is not a successful OpenAI phone verification; merchant invoice promise is not a checked Chinese VAT invoice.
const cat208=d.records.find(x=>x.id==='gpt-source-followup-r208-20261115');
const ev208=d.records.find(x=>x.id==='gpt-source-followup-r208-20261115-evidence');
assert(cat208&&ev208&&cat208.url.endsWith('supplier-followup-20261115-r18.html'));
const r208=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-15/supplier-followup-20261115-r18-evidence.json'),'utf8'));
assert.equal(r208.round,208);assert.equal(r208.site_version,'1.9.216');
assert.equal(r208.newly_read_evidence.payprm_independent_codex_phone_service.merchant_explicitly_guarantees_sms_receipt,false);
assert.equal(r208.newly_read_evidence.payprm_independent_codex_phone_service.cash_refund_if_no_sms_arrives_verified,null);
assert.equal(r208.newly_read_evidence.yaoyao_plus_operator_and_invoice.observed_one_account_one_month_retail_listing_cny,129);
assert.equal(r208.newly_read_evidence.yaoyao_plus_operator_and_invoice.invoice_fee_cny,null);
assert.equal(r208.newly_read_evidence.yaoyao_plus_operator_and_invoice.chinese_vat_invoice_verified,false);
assert.equal(r208.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r208.purchase_made,false);assert.equal(r208.credentials_submitted,false);

// R209: merchant-declared Session encryption is not deletion verification, a security audit or supply authorization.
const cat209=d.records.find(x=>x.id==='gpt-source-followup-r209-20261115');
const ev209=d.records.find(x=>x.id==='gpt-source-followup-r209-20261115-evidence');
assert(cat209&&ev209&&cat209.url.endsWith('supplier-followup-20261115-r19.html'));
const r209=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-15/supplier-followup-20261115-r19-evidence.json'),'utf8'));
assert.equal(r209.round,209);assert.equal(r209.site_version,'1.9.217');
assert.equal(r209.new_primary_source_evidence.aiplusgate_privacy.merchant_says_full_session_json_received,true);
assert.equal(r209.new_primary_source_evidence.aiplusgate_privacy.merchant_says_exception_handling_may_send_restricted_session_attachment_to_owner_private_chat,true);
assert.equal(r209.new_primary_source_evidence.aiplusgate_privacy.merchant_says_incomplete_order_cleanup_after_last_submission_days,7);
assert.equal(r209.new_primary_source_evidence.aiplusgate_privacy.merchant_says_local_backup_retention_days,14);
assert.equal(r209.new_primary_source_evidence.aiplusgate_privacy.third_party_independent_retention_and_deletion_verified,null);
assert.equal(r209.new_primary_source_evidence.aiplusgate_terms.merchant_explicitly_disclaims_authorization_from.includes('OpenAI'),true);
assert.equal(r209.new_primary_source_evidence.aiplusgate_terms.previous_ios_google_play_subscription_expired_wait_hours,72);
assert.equal(r209.new_primary_source_evidence.aiplusgate_terms.all_required_fees_with_valid_china_vat_cny,null);
assert.equal(r209.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r209.purchase_made,false);assert.equal(r209.credentials_submitted,false);assert.equal(r209.sms_test_done,false);

// R210: promo date text conflict is evidence, not proved year-long extension or checkout price.
const cat210=d.records.find(x=>x.id==='gpt-source-followup-r210-20261115');
const ev210=d.records.find(x=>x.id==='gpt-source-followup-r210-20261115-evidence');
assert(cat210&&ev210&&cat210.url.endsWith('supplier-followup-20261115-r20.html'));
const r210=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-15/supplier-followup-20261115-r20-evidence.json'),'utf8'));
assert.equal(r210.round,210);
assert.equal(r210.site_version,'1.9.218');
const claim210=r210.newly_read_primary_source_evidence.yinlujing_promotion_deadline_conflict;
assert.equal(claim210.original_announcement_deadline_bj,'2026-11-11T23:59:00+08:00');
assert.equal(claim210.current_announcement_deadline_bj,'2027-11-11T23:59:00+08:00');
assert.equal(claim210.current_sku_promo_banner_year,null);
assert.equal(claim210.actual_promo_deadline_verified,null);
assert.equal(claim210.same_price_tiers_recorded_on_2026_11_12,true);
assert.equal(claim210.agency_upfront_fee_cny,3000);
assert.equal(claim210.all_required_fees_with_valid_china_vat_cny,null);
assert.equal(r210.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r210.purchase_made,false);assert.equal(r210.sms_test_done,false);

// R211: an SMS entitlement is not a durable phone number or a verified Codex success.
const cat211=d.records.find(x=>x.id==='gpt-source-followup-r211-20261116');
const ev211=d.records.find(x=>x.id==='gpt-source-followup-r211-20261116-evidence');
assert(cat211&&ev211&&cat211.url.endsWith('supplier-followup-20261116-r01.html'));
const r211=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-16/supplier-followup-20261116-r01-evidence.json'),'utf8'));
assert.equal(r211.round,211);assert.equal(r211.site_version,'1.9.219');
const g211=r211.newly_read_primary_source_evidence.gpt_bujizhan_plus,sms211=r211.newly_read_primary_source_evidence.gpt_bujizhan_sms;
assert.equal(g211.price_cny_per_card,125);assert.equal(g211.online_payment_surcharge_rate,0.03);
assert.equal(g211.all_required_fees_with_valid_china_vat_cny,null);
assert.equal(r211.newly_read_primary_source_evidence.gpt_bujizhan_session.storage_and_deletion_audited,false);
assert.equal(sms211.cny_per_receive_entitlement,8);assert.equal(sms211.sms_entitlement_validity_days,30);
assert.equal(sms211.phone_number_validity_days,null);
assert.equal(sms211.automatic_original_payment_cash_refund_on_no_sms,false);
assert.equal(sms211.codex_sms_success_tested,false);
assert.equal(r211.newly_read_primary_source_evidence.zeroxzheng_sms.cny_price_visible_in_examined_page,null);
assert.equal(r211.qualification_totals.verified_true_plus_wholesale_upstreams,0);
assert.equal(r211.purchase_made,false);assert.equal(r211.sms_test_done,false);

// R212: documented post-delivery risk and US card policy are not verified invoice or SMS outcomes.
const cat212=d.records.find(x=>x.id==='gpt-source-followup-r212-20261116');
const ev212=d.records.find(x=>x.id==='gpt-source-followup-r212-20261116-evidence');
assert(cat212&&ev212&&cat212.url.endsWith('supplier-followup-20261116-r02.html'));
const r212=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-16/supplier-followup-20261116-r02-evidence.json'),'utf8'));
assert.equal(r212.round,212);assert.equal(r212.site_version,'1.9.220');
assert.equal(r212.new_primary_evidence.aibulk_contract_1_7_4.post_delivery_review_may_void_unredeemed_codes,true);
assert.equal(r212.new_primary_evidence.aibulk_contract_1_7_4.valid_china_vat_invoice_all_in_cny,null);
assert.equal(r212.new_primary_evidence.aibulk_contract_1_7_3.challenge_time_window_minutes_approximate_merchant_claim,5);
assert.equal(r212.new_primary_evidence.aibulk_gift_card_channel.merchant_claimed_region,'GLOBAL');
assert.equal(r212.new_primary_evidence.aibulk_gift_card_channel.official_gift_card_auto_starts_plus,false);
assert.equal(r212.new_primary_evidence.aibulk_gift_card_channel.current_seller_payable_unit_price_usdt,null);
assert.equal(r212.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r212.actual_purchase_made,false);assert.equal(r212.sms_test_done,false);

// R213: external reseller keys are not a verified upstream or verified phone service.
const cat213=d.records.find(x=>x.id==='gpt-source-followup-r213-20261116');
const ev213=d.records.find(x=>x.id==='gpt-source-followup-r213-20261116-evidence');
assert(cat213&&ev213&&cat213.url.endsWith('supplier-followup-20261116-r03.html'));
const r213=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-16/supplier-followup-20261116-r03-evidence.json'),'utf8'));
assert.equal(r213.round,213);assert.equal(r213.site_version,'1.9.221');
assert.equal(r213.newly_read_primary_source_evidence.hi_codex_retail_and_external_reseller_delivery.external_reseller_key_redemption_offered,true);
assert.equal(r213.newly_read_primary_source_evidence.hi_codex_retail_and_external_reseller_delivery.plus_merchant_quoted_price_cny,null);
assert.equal(r213.newly_read_primary_source_evidence.hi_codex_retail_and_external_reseller_delivery.key_external_sale_refunds_handled_by_original_seller,true);
assert.equal(r213.newly_read_primary_source_evidence.hi_codex_privacy_scope.independently_audited_session_deletion,false);
assert.equal(r213.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r213.actual_purchase_made,false);assert.equal(r213.sms_test_done,false);

// R214: the newly observed invoice fee and stale Japanese fee are self-claims, not a valid Chinese VAT invoice.
const cat214=d.records.find(x=>x.id==='gpt-source-followup-r214-20261116');
const ev214=d.records.find(x=>x.id==='gpt-source-followup-r214-20261116-evidence');
assert(cat214&&ev214&&cat214.url.endsWith('supplier-followup-20261116-r04.html'));
const r214=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-16/supplier-followup-20261116-r04-evidence.json'),'utf8'));
assert.equal(r214.round,214);assert.equal(r214.site_version,'1.9.222');
assert.equal(r214.new_primary_source_evidence.mainland_chinese_service.base_plus_claimed_invoice_fee_arithmetic_cny,215);
assert.equal(r214.new_primary_source_evidence.japanese_locale_older_page.conditional_one_invoice_preview_cny,205);
assert.equal(r214.new_primary_source_evidence.mainland_chinese_service.all_required_fees_with_valid_china_vat_cny,null);
assert.equal(r214.new_primary_source_evidence.refund_and_risk.real_cash_refund_verified,false);
assert.equal(r214.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r214.actual_purchase_made,false);assert.equal(r214.sms_test_done,false);

// R215: documented aggregator capability does not imply real Codex routing or a retail price.
const cat215=d.records.find(x=>x.id==='gpt-source-followup-r215-20261116');
const ev215=d.records.find(x=>x.id==='gpt-source-followup-r215-20261116-evidence');
assert(cat215&&ev215&&cat215.url.endsWith('supplier-followup-20261116-r05.html'));
const r215=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-16/supplier-followup-20261116-r05-evidence.json'),'utf8'));
assert.equal(r215.round,215);assert.equal(r215.site_version,'1.9.223');
assert.equal(r215.new_primary_source_evidence.merchant_supplier_claim_already_archived_in_round,211);
assert.equal(r215.new_primary_source_evidence.upstream_service_api.service_list_exposes_service_id_provider_cost_fields,true);
assert.equal(r215.new_primary_source_evidence.upstream_service_api.actual_codex_upstream_cost,null);
assert.equal(r215.new_primary_source_evidence.separate_upstream_monthly_number_product.api_example_not_live_quote,true);
assert.equal(r215.new_primary_source_evidence.separate_upstream_monthly_number_product.api_example_price_currency,null);
assert.equal(r215.new_primary_source_evidence.merchant_rule_exact.admin_storage_actual_retention_days,null);
assert.equal(r215.new_primary_source_evidence.upstream_privacy_policy.server_log_not_same_as_sms_code_retention,true);
assert.equal(r215.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r215.actual_purchase_made,false);assert.equal(r215.credentials_submitted,false);assert.equal(r215.sms_test_done,false);

// R216: Apple/iOS subscription routing and Session handling coexist in the merchant claim;
// advertised invoice option is not a verified Chinese VAT invoice or a wholesale price.
const cat216=d.records.find(x=>x.id==='gpt-source-followup-r216-20261116');
const ev216=d.records.find(x=>x.id==='gpt-source-followup-r216-20261116-evidence');
assert(cat216&&ev216&&cat216.url.endsWith('supplier-followup-20261116-r06.html'));
const r216=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-16/supplier-followup-20261116-r06-evidence.json'),'utf8'));
assert.equal(r216.round,216);assert.equal(r216.site_version,'1.9.224');
assert.equal(r216.new_retail_candidate.individual_month_listed_cny,158);
assert.equal(r216.new_retail_candidate.merchant_invoice_option_month_listed_cny,168);
assert.equal(r216.new_retail_candidate.actual_all_required_fees_with_verified_chinese_vat_cny,null);
assert.equal(r216.new_retail_candidate.ios_and_session_delivery_merchant_claim_coexist,true);
assert.equal(r216.new_retail_candidate.formal_openai_resale_authorization_verified,false);
assert.equal(r216.new_retail_candidate.real_successful_delivery_or_cash_refund_tested,false);
assert.equal(r216.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r216.actual_purchase_made,false);assert.equal(r216.sms_test_done,false);

// r217: verify distinct agent/referral programs and conflicting SMS SKU prices.
const cat217=d.records.find(x=>x.id==='gpt-source-followup-r217-20261116');
const ev217=d.records.find(x=>x.id==='gpt-source-followup-r217-20261116-evidence');
assert(cat217&&ev217&&cat217.url.endsWith('supplier-followup-20261116-r07.html'));
const r217=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-16/supplier-followup-20261116-r07-evidence.json'),'utf8'));
assert.equal(r217.round,217);assert.equal(r217.site_version,'1.9.225');
assert.equal(r217.new_candidate.claimed_plus_1_cny,115);
assert.equal(r217.new_candidate.another_upstream_intro_one_time_fee_cny,1888);
assert.equal(r217.new_candidate.actual_wholesale_purchase_price_cny,null);
assert.equal(r217.separate_paid_tiers.partner_fee_cny,88);
assert.equal(r217.independent_sms.shop_display_cny_per_single_order,27.99);
assert.equal(r217.independent_sms.body_claim_cny_per_successful_sms,5);
assert.equal(r217.independent_sms.codex_desktop_sms_success,null);
assert.equal(r217.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r217.actual_purchase_made,false);assert.equal(r217.sms_test_done,false);

// r218: directory links, not verified legal operator or current seller checkout prices.
const cat218=d.records.find(x=>x.id==='gpt-source-followup-r218-20261116');
const ev218=d.records.find(x=>x.id==='gpt-source-followup-r218-20261116-evidence');
assert(cat218&&ev218&&cat218.url.endsWith('supplier-followup-20261116-r08.html'));
const r218=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-16/supplier-followup-20261116-r08-evidence.json'),'utf8'));
assert.equal(r218.round,218);assert.equal(r218.site_version,'1.9.226');
assert.equal(r218.new_primary_source_evidence.three_store_routes.length,3);
assert.equal(r218.new_primary_source_evidence.three_store_routes[0].platform_domain,'catfk.com');
assert.equal(r218.new_primary_source_evidence.shared_legal_operator_verified,null);
assert.equal(r218.new_primary_source_evidence.directory_only_plus_reference.listed_price_cny,132.9);
assert.equal(r218.new_primary_source_evidence.directory_only_plus_reference.directory_price_check_date,'2026-11-09');
assert.equal(r218.new_primary_source_evidence.directory_only_plus_reference.current_store_listing_cny,null);
assert.equal(r218.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r218.actual_purchase_made,false);assert.equal(r218.sms_test_done,false);


// r219: verify fee delta of exact Hype card SKU versus separate 6% categories; no proven payable VAT or checkout.
const cat219=d.records.find(x=>x.id==='gpt-source-followup-r219-20261117');
const ev219=d.records.find(x=>x.id==='gpt-source-followup-r219-20261117-evidence');
assert(cat219&&ev219&&cat219.url.endsWith('supplier-followup-20261117-r01.html'));
const r219=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-17/supplier-followup-20261117-r01-evidence.json'),'utf8'));
assert.equal(r219.round,219);assert.equal(r219.site_version,'1.9.227');
const h219=r219.material_findings;
assert.equal(h219.plus_card.observed_2026_11_15_alipay_rate,0.06);
assert.equal(h219.plus_card.observed_2026_11_17_alipay_rate,0.068);
assert.equal(h219.plus_card.observed_2026_11_15_unpaid_preview_cny,113.42);
assert.equal(h219.plus_card.observed_2026_11_17_unpaid_preview_cny,114.28);
assert.equal(h219.plus_card.actual_successful_checkout_cny,null);
assert.equal(h219.plus_ios.price_table_advertised_cny_per_account_month,133);
assert.equal(h219.plus_ios.product_sku_selector_advertised_cny_per_account_month,135);
assert.equal(h219.plus_ios.actual_selected_ios_checkout_total_cny,null);
assert.equal(h219.payment_fee_scope.separate_codex_sms_sku_fee,0.06);
assert.equal(h219.payment_fee_scope.globally_uniform_fee_assumed,false);
assert.equal(h219.supplier_qualification.valid_china_vat_invoice_verified,false);
assert.equal(r219.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r219.actual_purchase_made,false);assert.equal(r219.sms_test_done,false);

// r220: third-party registration number is an independent lookup lead, NOT official business or actual payee/invoice verification.
const cat220=d.records.find(x=>x.id==='gpt-source-followup-r220-20261117');
const ev220=d.records.find(x=>x.id==='gpt-source-followup-r220-20261117-evidence');
assert(cat220&&ev220&&cat220.url.endsWith('supplier-followup-20261117-r02.html'));
const r220=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-17/supplier-followup-20261117-r02-evidence.json'),'utf8'));
assert.equal(r220.round,220);assert.equal(r220.site_version,'1.9.228');
const g220=r220.material_findings;
assert.equal(g220.independent_company_directory.listed_business_registration_no,'80542846');
assert.equal(g220.independent_company_directory.listed_incorporation_date,'2026-06-03');
assert.equal(g220.merchant_link_status.merchant_claim_of_operator_independently_proven,false);
assert.equal(g220.government_source.company_name_directly_located_in_official_dataset,false);
assert.equal(g220.second_company_index.direct_page_fetch_succeeded,false);
assert.equal(g220.merchant_link_status.actual_payment_receiving_legal_entity,null);
assert.equal(g220.merchant_link_status.all_required_fees_china_vat_inclusive_cny,null);
assert.equal(g220.archived_plus_reference.same_sku_new_2026_11_17_quote_verified,null);
assert.equal(r220.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r220.actual_purchase_made,false);assert.equal(r220.sms_test_done,false);

// r222: API examples are not authenticated prices and do not prove official authorization.
const r222cat=d.records.find(x=>x.id==='gpt-source-followup-r222-20261117');
const r222ev=d.records.find(x=>x.id==='gpt-source-followup-r222-20261117-evidence');
assert(r222cat&&r222ev&&r222cat.url.endsWith('supplier-followup-20261117-r04.html'));
const r222=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-17/supplier-followup-20261117-r04-evidence.json'),'utf8'));
assert.equal(r222.round,222);assert.equal(r222.site_version,'1.9.230');
assert.equal(r222.material_findings.maplepass.actual_approved_one_unit_wholesale_price_usdt,null);
assert.equal(r222.material_findings.maplepass.valid_china_vat_invoice_verified,false);
assert.equal(r222.material_findings.maplepass.verified_openai_resale_authorization,false);
assert.equal(r222.material_findings.maplepass.min_order_quantity_api_example,1);
assert.equal(r222.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r222.actual_purchase_made,false);assert.equal(r222.sms_test_done,false);

// r221: seller's on-site SMS price is NOT its off-site price; cash refund policy differs from wallet credit.
const cat221=d.records.find(x=>x.id==='gpt-source-followup-r221-20261117');
const ev221=d.records.find(x=>x.id==='gpt-source-followup-r221-20261117-evidence');
assert(cat221&&ev221&&cat221.url.endsWith('supplier-followup-20261117-r03.html'));
const r221=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-17/supplier-followup-20261117-r03-evidence.json'),'utf8'));
assert.equal(r221.round,221);assert.equal(r221.site_version,'1.9.229');
assert.equal(r221.material_findings.getgpt_codex_phone.store_subscriber_claimed_cny_per_one_sms_attempt,10);
assert.equal(r221.material_findings.getgpt_codex_phone.non_store_actual_cny_per_one_sms_attempt,null);
assert.equal(r221.material_findings.getgpt_codex_phone.hero_sms_actual_reseller_or_supplier_link_verified,false);
assert.equal(r221.material_findings.hero_sms_independent_service.refund_policy_general_cash_minimum_usd,10);
assert.equal(r221.material_findings.hero_sms_independent_service.refund_policy_general_cash_fee_rate,0.05);
assert.equal(r221.material_findings.hero_sms_independent_service.no_sms_original_payment_cash_refund_automatic,false);
assert.equal(r221.material_findings.hero_sms_independent_service.actual_platform_sms_accepted,false);
assert.equal(r221.material_findings.official_scope.voip_numbers_supported,false);
assert.equal(r221.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r221.actual_purchase_made,false);assert.equal(r221.sms_test_done,false);

// R223: correct historical first discovery and reference-price classification.
const cat223=d.records.find(x=>x.id==='gpt-source-followup-r223-20261117');
const data223=d.records.find(x=>x.id==='gpt-source-followup-r223-20261117-evidence');
assert(cat223&&data223&&cat223.url.endsWith('supplier-followup-20261117-r05.html'));
const r223=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-17/supplier-followup-20261117-r05-evidence.json'),'utf8'));
assert.equal(r223.round,223);assert.equal(r223.site_version,'1.9.231');
assert.equal(r223.material_correction.first_documented_round,53);
assert.equal(r223.material_correction.prior_recheck_round,119);
assert.equal(r223.material_correction.already_documented_google_reference_usdt_per_piece,15.5);
assert.equal(r223.material_correction.already_documented_standard_gptplus_reference_usdt_per_piece_at_r119,16.2);
assert.equal(r223.material_correction.newly_authenticated_price_cny,null);
assert.equal(r223.material_correction.merchant_reference_is_authenticated_price,false);
assert.equal(r223.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r223.actual_purchase_made,false);assert.equal(r223.sms_test_done,false);

// R224: exact Google-channel SKU has conflicting seller warranty language across dates; not a verified real refund.
const cat224=d.records.find(x=>x.id==='gpt-source-followup-r224-20261117');
const data224=d.records.find(x=>x.id==='gpt-source-followup-r224-20261117-evidence');
assert(cat224&&data224&&cat224.url.endsWith('supplier-followup-20261117-r06.html'));
const r224=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-17/supplier-followup-20261117-r06-evidence.json'),'utf8'));
assert.equal(r224.round,224);assert.equal(r224.site_version,'1.9.232');
assert.equal(r224.material_observation.sku,'gptplus_google');
assert.equal(r224.material_observation.older_evidence.merchant_claim_subscription_drop_risk_percent,3);
assert.equal(r224.material_observation.new_current_product_page.merchant_claim_subscription_drop_risk_percent_approx,5);
assert.equal(r224.material_observation.older_evidence.merchant_claim_ongoing_warranty,false);
assert.equal(r224.material_observation.new_current_product_page.merchant_claim_warranty,true);
assert.equal(r224.material_observation.new_current_product_page.retail_usdt_per_item_month,15.8);
assert.equal(r224.material_observation.actual_policy_effective_date_verified,null);
assert.equal(r224.buyer_missing_evidence.all_fee_valid_china_vat_total_cny,null);
assert.equal(r224.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r224.actual_purchase_made,false);assert.equal(r224.sms_test_done,false);

// R225: new AICZ catalog is a reseller/referral channel, NOT a vetted wholesale source or a verified phone test.
const cat225=d.records.find(x=>x.id==='gpt-source-followup-r225-20261117');
const data225=d.records.find(x=>x.id==='gpt-source-followup-r225-20261117-evidence');
assert(cat225&&data225&&cat225.url.endsWith('supplier-followup-20261117-r07.html'));
const r225=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-17/supplier-followup-20261117-r07-evidence.json'),'utf8'));
assert.equal(r225.round,225);assert.equal(r225.site_version,'1.9.233');
assert.equal(r225.sku_observations[0].price_cny_per_item_month,130.8);
assert.equal(r225.sku_observations[0].actual_checkout_total_cny,null);
assert.equal(r225.sku_observations[1].price_cny_per_item_month,126);
assert.equal(r225.sku_observations[1].redirect_destination_directly_readable,false);
assert.equal(r225.sku_observations[2].price_cny_per_one_seller_claimed_activation,3.6);
assert.equal(r225.sku_observations[2].actual_sms_success_verified,false);
assert.equal(r225.merchant_terms.cooperative_subsites_supply_and_collect_payment_seller_claim,true);
assert.equal(r225.merchant_terms.merchant_channel_information_service_fee_required,true);
assert.equal(r225.merchant_terms.channel_information_service_fee_amount_cny,null);
assert.equal(r225.merchant_terms.upstream_agent_fee_amount_cny,null);
assert.equal(r225.buyer_missing_evidence.all_required_fees_invoice_included_cny,null);
assert.equal(r225.buyer_missing_evidence.valid_china_vat_invoice_verified,false);
assert.equal(r225.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r225.actual_purchase_made,false);assert.equal(r225.sms_test_done,false);

 // R226: merchant Google SKU is shown temporarily unavailable; separate PH Plus and Codex SMS remain seller-listed.
const cat226=d.records.find(x=>x.id==='gpt-source-followup-r226-20261117');
const data226=d.records.find(x=>x.id==='gpt-source-followup-r226-20261117-evidence');
assert(cat226&&data226&&cat226.url.endsWith('supplier-followup-20261117-r08.html'));
const r226=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-17/supplier-followup-20261117-r08-evidence.json'),'utf8'));
assert.equal(r226.round,226);assert.equal(r226.site_version,'1.9.234');
assert.equal(r226.material_observation.older_repo_evidence.merchant_stock_label,'有货 · 自动发卡');
assert.equal(r226.material_observation.directly_read_now.merchant_stock_label,'暂不可购买');
assert.equal(r226.material_observation.price_changed,false);
assert.equal(r226.material_observation.directly_read_now.price_cny_per_item,126);
assert.equal(r226.material_observation.confirmed_permanent_discontinuation,false);
assert.equal(r226.other_sku_separate_checks[0].price_cny_per_item_month,130.8);
assert.equal(r226.other_sku_separate_checks[1].price_cny_per_single_sms,3.6);
assert.equal(r226.payment_authorization_gaps.actual_gpay_google_sku_purchase_total_cny,null);
assert.equal(r226.payment_authorization_gaps.valid_china_vat_invoice_verified,false);
assert.equal(r226.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r226.actual_purchase_made,false);assert.equal(r226.sms_test_done,false);

 // R227: first independent primary government registry cross-check for GetVIP self-claimed Spanish legal name, not merchant identity/invoice/wholesale proof.
const cat227=d.records.find(x=>x.id==='gpt-source-followup-r227-20261117');
const data227=d.records.find(x=>x.id==='gpt-source-followup-r227-20261117-evidence');
assert(cat227&&data227&&cat227.url.endsWith('supplier-followup-20261117-r09.html'));
const r227=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-17/supplier-followup-20261117-r09-evidence.json'),'utf8'));
assert.equal(r227.round,227);assert.equal(r227.site_version,'1.9.235');
assert.equal(r227.finding.independent_government_record.entry,'429248');
assert.equal(r227.finding.independent_government_record.published_on,'2026-09-24');
assert.equal(r227.finding.independent_company_directory.cif,'B93979136');
assert.equal(r227.finding.reconciliation.road_type_exact_match,false);
assert.equal(r227.finding.reconciliation.merchant_website_legal_entity_link_independently_verified,false);
assert.equal(r227.unresolved_procurement.actual_payment_collecting_legal_entity,null);
assert.equal(r227.unresolved_procurement.actual_invoice_issuer,null);
assert.equal(r227.unresolved_procurement.invoice_fee_cny,null);
assert.equal(r227.unresolved_procurement.valid_chinese_vat_invoice_verified,false);
assert.equal(r227.current_sku_context.actual_checkout_total_cny,null);
assert.equal(r227.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r227.actual_purchase_made,false);assert.equal(r227.sms_test_done,false);

 // R228: exact Morimm iOS SKU price difference; eligibility-restricted Plus is NOT a universal low-price wholesale.
const cat228=d.records.find(x=>x.id==='gpt-source-followup-r228-20261117');
const data228=d.records.find(x=>x.id==='gpt-source-followup-r228-20261117-evidence');
assert(cat228&&data228&&cat228.url.endsWith('supplier-followup-20261117-r10.html'));
const r228=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-17/supplier-followup-20261117-r10-evidence.json'),'utf8'));
assert.equal(r228.round,228);assert.equal(r228.site_version,'1.9.236');
assert.equal(r228.material_observations[0].archived_same_sku.display_price_cny_per_one_month_card,129);
assert.equal(r228.material_observations[0].current_same_sku.display_price_cny_per_one_month_card,125);
assert.equal(r228.material_observations[0].observed_public_price_difference_cny,-4);
assert.equal(r228.material_observations[0].actual_paid_price_change_verified,false);
assert.equal(r228.material_observations[1].archived_same_sku.display_price_cny_per_eligible_order,65);
assert.equal(r228.material_observations[1].current_same_sku.display_price_cny_per_eligible_order,62);
assert.equal(r228.material_observations[1].requires_preexisting_official_half_price_qualification,true);
assert.equal(r228.material_observations[1].applies_to_arbitrary_own_account,false);
assert.equal(r228.non_change_first_party_checks.morimm_codex_sms.seller_price_cny_per_one_cdk,4);
assert.equal(r228.unresolved_procurement.all_required_fees_and_invoice_included_total_cny,null);
assert.equal(r228.qualification_totals.verified_plus_wholesale_upstreams,0);
assert.equal(r228.actual_purchase_made,false);assert.equal(r228.sms_test_done,false);

// R229: one exact Google SKU now shows seller purchase availability, not paid proof.
const cat229=d.records.find(x=>x.id==='gpt-source-followup-r229-20261117');
const data229=d.records.find(x=>x.id==='gpt-source-followup-r229-20261117-evidence');
assert(cat229&&data229&&cat229.url.endsWith('supplier-followup-20261117-r11.html'));
const r229=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-17/supplier-followup-20261117-r11-evidence.json'),'utf8'));
assert.equal(r229.round,229);assert.equal(r229.site_version,'1.9.237');
assert.equal(r229.material_observation.archive_previous.stock_label,'暂不可购买');
assert.equal(r229.material_observation.current_observation.stock_label,'有货 · 自动发卡');
assert.equal(r229.material_observation.current_observation.price_cny_per_one_card,126);
assert.equal(r229.material_observation.current_observation.purchase_button_present,true);
assert.equal(r229.material_observation.price_change_cny,0);
assert.equal(r229.material_observation.actual_paid_checkout_total_cny,null);
assert.equal(r229.payment_party_evidence_gap.actual_payment_receiving_legal_entity,null);
assert.equal(r229.unresolved_procurement.all_mandatory_payment_and_vat_included_total_cny,null);
assert.equal(r229.qualifying_total.verified_true_plus_wholesale_upstreams,0);
assert.equal(r229.actual_purchase_made,false);assert.equal(r229.sms_test_done,false);

// R230: merchant invoice-process statement is not a verified VAT invoice, no new true wholesale.
const c230=d.records.find(x=>x.id==='gpt-source-followup-r230-20261118');
const e230=d.records.find(x=>x.id==='gpt-source-followup-r230-20261118-evidence');
assert(c230&&e230&&c230.url.endsWith('supplier-followup-20261118-r01.html'));
const r230=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-18/supplier-followup-20261118-r01-evidence.json'),'utf8'));
assert.equal(r230.round,230);assert.equal(r230.site_version,'1.9.238');
assert.equal(r230.material_observation.current_invoice_page.seller_explicit_invoice_type,'增值税普通发票');
assert.equal(r230.material_observation.current_invoice_page.seller_quoted_time_limit_business_days,3);
assert.equal(r230.material_observation.current_invoice_page.reported_invoice_fee_cny,null);
assert.equal(r230.material_observation.old_search_index_discrepancy.not_proof_current_fee_percent,true);
assert.equal(r230.material_observation.actual_invoice_issuing_legal_entity,null);
assert.equal(r230.material_observation.seller_display_price_cny_per_one_account_one_month,129);
assert.equal(r230.qualification_totals.verified_true_plus_wholesale_upstreams,0);
assert.equal(r230.actual_purchase_made,false);assert.equal(r230.sms_test_done,false);

// R231: independent merchant price and fee scopes, no new qualified legal wholesale or SMS success.
const c231=d.records.find(x=>x.id==='gpt-source-followup-r231-20261118');
const e231=d.records.find(x=>x.id==='gpt-source-followup-r231-20261118-evidence');
assert(c231&&e231&&c231.url.endsWith('supplier-followup-20261118-r02.html'));
const r231=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-18/supplier-followup-20261118-r02-evidence.json'),'utf8'));
assert.equal(r231.round,231);assert.equal(r231.site_version,'1.9.239');
assert.equal(r231.material_observation.plus_card.previous_base_cny_per_account_month,107);
assert.equal(r231.material_observation.plus_card.current_base_cny_per_account_month,117);
assert.equal(r231.material_observation.plus_card.previous_unpaid_preview_cny,114.28);
assert.equal(r231.material_observation.plus_card.current_unpaid_preview_cny,124.96);
assert.equal(r231.material_observation.plus_card.valid_chinese_vat_invoice_included_total_cny,null);
assert.equal(r231.material_observation.plus_ios.current_price_table_cny_per_account_month,135);
assert.equal(r231.material_observation.codex_sms.current_2026_11_18_alipay_rate,0.068);
assert.equal(r231.material_observation.codex_sms.sms_success_tested,false);
assert.equal(r231.material_observation.agent.current_unpaid_preview_cny,105.74);
assert.equal(r231.qualification_totals.verified_true_plus_wholesale_upstreams,0);
assert.equal(r231.actual_purchase_made,false);assert.equal(r231.sms_test_done,false);

// R232: same SKU sold-out label, unknown previous stock, no inferred paid transaction.
const c232=d.records.find(x=>x.id==='gpt-source-followup-r232-20261118');
const e232=d.records.find(x=>x.id==='gpt-source-followup-r232-20261118-evidence');
assert(c232&&e232&&c232.url.endsWith('supplier-followup-20261118-r03.html'));
const r232=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-18/supplier-followup-20261118-r03-evidence.json'),'utf8'));
assert.equal(r232.round,232);assert.equal(r232.site_version,'1.9.240');
assert.equal(r232.material_observation.current_seller_stock_label,'已售罄');
assert.equal(r232.material_observation.purchase_button_label,'已售罄');
assert.equal(r232.material_observation.previous_round_recorded_same_sku_stock_label,null);
assert.equal(r232.material_observation.current_while_sold_out_unpaid_checkout_total_cny,null);
assert.equal(r232.material_observation.current_seller_display_price_cny_per_phone,12);
assert.equal(r232.seller_sms_claims.actual_sms_success_verified,false);
assert.equal(r232.qualification_totals.verified_true_plus_wholesale_upstreams,0);
assert.equal(r232.actual_purchase_made,false);assert.equal(r232.sms_test_done,false);


// R233: first primary government company registration proof; seller identity/wholesale remains unverified.
const c233=d.records.find(x=>x.id==='gpt-source-followup-r233-20261118');
const e233=d.records.find(x=>x.id==='gpt-source-followup-r233-20261118-evidence');
assert(c233&&e233&&c233.url.endsWith('supplier-followup-20261118-r04.html'));
const r233=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-18/supplier-followup-20261118-r04-evidence.json'),'utf8'));
assert.equal(r233.round,233);assert.equal(r233.site_version,'1.9.241');
assert.equal(r233.material_observation.government_business_registration_number,'80542846');
assert.equal(r233.material_observation.government_pdf_page_printed,502);
assert.equal(r233.material_observation.government_record_sequence,4014);
assert.equal(r233.material_observation.government_incorporation_date,'2026-06-03');
assert.equal(r233.material_observation.prior_merchant_company_name_already_recorded_round,220);
assert.equal(r233.material_observation.merchant_terms_claim_effective_on,'2026-06-02');
assert.equal(r233.material_observation.government_record_proves_domain_or_seller_ownership,false);
assert.equal(r233.material_observation.mandatory_all_in_plus_cost_cny,null);
assert.equal(r233.qualification_totals.verified_true_plus_wholesale_upstreams,0);
assert.equal(r233.actual_purchase_made,false);assert.equal(r233.sms_test_done,false);

// R234: one-item CatFK Antipro preview must not be mistaken for VAT-inclusive paid wholesale.
const c234=d.records.find(x=>x.id==='gpt-source-followup-r234-20261118');
const ev234=d.records.find(x=>x.id==='gpt-source-followup-r234-20261118-evidence');
assert(c234&&ev234&&c234.url.endsWith('supplier-followup-20261118-r05.html'));
const r234=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-18/supplier-followup-20261118-r05-evidence.json'),'utf8'));
assert.equal(r234.round,234);assert.equal(r234.site_version,'1.9.242');
assert.equal(r234.material_observation.price_cny_per_one_account_one_month,118);
assert.equal(r234.material_observation.unpaid_checkout_surcharge_cny,3.3);
assert.equal(r234.material_observation.unpaid_checkout_preview_cny,121.3);
assert.equal(r234.material_observation.previously_archived_separate_product.is_distinct_sku,true);
assert.equal(r234.material_observation.china_vat_eligible_for_this_one_unit_under_public_terms,false);
assert.equal(r234.material_observation.actual_all_in_with_valid_china_vat_cny,null);
assert.equal(r234.qualification_totals.verified_true_plus_wholesale_upstreams,0);
assert.equal(r234.actual_purchase_made,false);assert.equal(r234.real_order_submitted,false);assert.equal(r234.sms_test_done,false);

// R235: independent AICZ Google and Philippine original-account Plus seller availability must not imply paid checkout or wholesale.
const c235=d.records.find(x=>x.id==='gpt-source-followup-r235-20261118');
const e235=d.records.find(x=>x.id==='gpt-source-followup-r235-20261118-evidence');
assert(c235&&e235&&c235.url.endsWith('supplier-followup-20261118-r06.html'));
const r235=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-18/supplier-followup-20261118-r06-evidence.json'),'utf8'));
assert.equal(r235.round,235);assert.equal(r235.site_version,'1.9.243');
assert.equal(r235.material_observations.length,2);
assert.equal(r235.material_observations[0].amount_cny,126);
assert.equal(r235.material_observations[1].amount_cny,130.8);
for(const sku of r235.material_observations){assert.equal(sku.prior_archived.seller_stock_label,'有货 · 自动发卡');assert.equal(sku.fresh.seller_stock_label,'暂不可购买');assert.equal(sku.fresh.purchase_button_present,false);assert.equal(sku.actual_stock_tested,false);assert.equal(sku.actual_available_checkout_total_cny,null);}
assert.equal(r235.qualification_totals.verified_true_plus_wholesale_upstreams,0);
assert.equal(r235.merchant_terms.actual_all_mandatory_fees_including_valid_china_vat_cny,null);
assert.equal(r235.actual_purchase_made,false);assert.equal(r235.real_order_submitted,false);assert.equal(r235.sms_test_done,false);

// R236: AICZ Philippine Plus seller-listed return to availability; Google SKU still unavailable.
const c236=d.records.find(x=>x.id==='gpt-source-followup-r236-20261118');
const e236=d.records.find(x=>x.id==='gpt-source-followup-r236-20261118-evidence');
assert(c236&&e236&&c236.url.endsWith('supplier-followup-20261118-r07.html'));
const r236=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-18/supplier-followup-20261118-r07-evidence.json'),'utf8'));
assert.equal(r236.round,236);assert.equal(r236.site_version,'1.9.244');
assert.equal(r236.material_observation.older_archived.seller_stock_label,'暂不可购买');
assert.equal(r236.material_observation.fresh.seller_stock_label,'有货 · 自动发卡');
assert.equal(r236.material_observation.fresh.purchase_button_present,true);
assert.equal(r236.material_observation.seller_price_cny_per_one_month_card,130.8);
assert.equal(r236.material_observation.actual_paid_checkout_total_cny,null);
assert.equal(r236.separate_sku_nonchange.seller_stock_label,'暂不可购买');
assert.equal(r236.procurement_evidence_gaps.all_mandatory_payment_and_valid_china_vat_total_cny,null);
assert.equal(r236.qualification_totals.verified_true_plus_wholesale_upstreams,0);
assert.equal(r236.actual_purchase_made,false);assert.equal(r236.sms_test_done,false);

// R237: direct first-party same-SKU lower listed price, separate Google/direct-link SKUs; still no proof of paid VAT-inclusive wholesale.
const c237=d.records.find(x=>x.id==='gpt-source-followup-r237-20261118');
const e237=d.records.find(x=>x.id==='gpt-source-followup-r237-20261118-evidence');
assert(c237&&e237&&c237.url.endsWith('supplier-followup-20261118-r08.html'));
const r237=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-18/supplier-followup-20261118-r08-evidence.json'),'utf8'));
assert.equal(r237.round,237);assert.equal(r237.site_version,'1.9.245');
assert.equal(r237.material_observation.previous_archived.price_cny_per_card_month,130.8);
assert.equal(r237.material_observation.fresh.price_cny_per_card_month,129.6);
assert.equal(r237.material_observation.seller_display_price_difference_cny,-1.2);
assert.equal(r237.material_observation.fresh.seller_stock_label,'有货 · 自动发卡');
assert.equal(r237.material_observation.actual_paid_checkout_total_cny,null);
assert.equal(r237.separate_skus[0].seller_stock_label,'暂不可购买');
assert.equal(r237.separate_skus[1].first_listed_date_verified,null);
assert.equal(r237.unknowns.all_mandatory_payment_and_valid_china_vat_total_cny,null);
assert.equal(r237.qualification_totals.verified_true_plus_wholesale_upstreams,0);
assert.equal(r237.actual_purchase_made,false);assert.equal(r237.sms_test_done,false);


// R238: new first-party reseller application is a lead, not approved one-unit wholesale or a paid VAT-inclusive purchase.
const c238=d.records.find(x=>x.id==='gpt-source-followup-r238-20261119');
const e238=d.records.find(x=>x.id==='gpt-source-followup-r238-20261119-evidence');
assert(c238&&e238&&c238.url.endsWith('supplier-followup-20261119.html'));
const r238=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-19/supplier-followup-20261119-evidence.json'),'utf8'));
assert.equal(r238.round,238);assert.equal(r238.site_version,'1.9.246');
assert.equal(r238.discovery.new_first_party_reseller_program.true_approved_wholesale_price_cny_per_one_plus_month,null);
assert.equal(r238.discovery.new_first_party_reseller_program.confirmed_agent_no_upfront_fee,null);
assert.equal(r238.discovery.new_first_party_reseller_program.seller_example_only_not_actual_price.example_only,true);
assert.deepEqual(r238.discovery.distinct_retail_skus.map(x=>x.id),['XHW-GPTPLUS-PH-CARD-1M','GPTPLUS-MANUAL-1M','MANUAL-REGION-PLUS-CONFIGURATOR']);
assert.equal(r238.discovery.distinct_retail_skus[0].display_price_cny_per_one_free_existing_account_one_month,168);
assert.equal(r238.discovery.distinct_retail_skus[2].requires_account_page_code_or_token,true);
assert.equal(r238.procurement_unknowns.all_in_cny,null);
assert.equal(r238.qualification_totals.verified_true_plus_wholesale_upstreams,0);
assert.equal(r238.actual_purchase_made,false);assert.equal(r238.sms_test_done,false);

// R241: current shared seats are NOT own-account Plus; merchant stock labels are observations, not paid orders.
const c241=d.records.find(x=>x.id==='gpt-source-followup-r241-20261119');
const e241=d.records.find(x=>x.id==='gpt-source-followup-r241-20261119-evidence');
assert(c241&&e241&&c241.url.endsWith('supplier-followup-20261119-r04.html'));
const r241=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-19/supplier-followup-20261119-r04-evidence.json'),'utf8'));
assert.equal(r241.round,241);assert.equal(r241.site_version,'1.9.249');
assert.equal(r241.material_observations[0].same_sku_comparisons[0].current_first_party_price_cny,38);
assert.equal(r241.material_observations[0].same_sku_comparisons[1].current_first_party_price_cny,68);
assert.equal(r241.material_observations[0].price_is_not_own_account_wholesale,true);
assert.equal(r241.material_observations[1].merchant_page_sequence[1].merchant_stock_label,'有货 · 自动发卡');
assert.equal(r241.material_observations[1].merchant_page_sequence[2].merchant_stock_label,'暂不可购买');
assert.equal(r241.material_observations[1].actual_payment_total_cny,null);
assert.equal(r241.procurement.valid_china_vat_invoice_fee_cny??r241.procurement.invoice_fee_cny,null);
assert.equal(r241.qualification_totals.verified_true_plus_wholesale_upstreams,0);
assert.equal(r241.actual_purchase_made,false);

// R242: retailer's newly-read API documentation is not an approved one-unit wholesale price or VAT invoice.
const c242=d.records.find(x=>x.id==='gpt-source-followup-r242-20261119');
const e242=d.records.find(x=>x.id==='gpt-source-followup-r242-20261119-evidence');
assert(c242&&e242&&c242.url.endsWith('supplier-followup-20261119-r05.html'));
const r242=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-19/supplier-followup-20261119-r05-evidence.json'),'utf8'));
assert.equal(r242.round,242);assert.equal(r242.site_version,'1.9.250');
assert.equal(r242.material_observations[0].public_minimum_online_order_units,1);
assert.equal(r242.material_observations[0].public_minimum_is_wholesale_threshold,false);
assert.equal(r242.material_observations[0].automatic_bulk_price_tiers_on_seller_page,false);
assert.equal(r242.material_observations[0].verified_plus_wholesale_unit_price_cny,null);
assert.equal(r242.material_observations[0].api_requires_approved_client,true);
assert.equal(r242.material_observations[0].docs_wholesale_price_example_is_hypothetical,true);
assert.equal(r242.material_observations[0].actual_api_call_tested,false);
assert.equal(r242.procurement.payment_surcharge_cny,null);
assert.equal(r242.procurement.invoice_fee_cny,null);
assert.equal(r242.qualification_totals.verified_true_plus_wholesale_upstreams,0);
assert.equal(r242.actual_purchase_made,false);

// R240: new agent route and cumulative upgrade claims are seller terms, not a verified wholesale privilege.
const c240=d.records.find(x=>x.id==='gpt-source-followup-r240-20261119');
const e240=d.records.find(x=>x.id==='gpt-source-followup-r240-20261119-evidence');
assert(c240&&e240&&c240.url.endsWith('supplier-followup-20261119-r03.html'));
const r240=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-19/supplier-followup-20261119-r03-evidence.json'),'utf8'));
assert.equal(r240.round,240);assert.equal(r240.site_version,'1.9.248');
assert.equal(r240.material_observation.present_first_party_terms_seller_claims_one_agent_channel_tier,true);
assert.equal(r240.material_observation.present_first_party_terms_seller_claims_new_second_level_subsite_sales_no_longer_open,true);
assert.equal(r240.material_observation.upstream_plus_wholesale_single_month_price_cny,null);
assert.equal(r240.material_observation.valid_china_vat_invoice_issuer,null);
assert.equal(r240.attempted_obsolete_route.direct_fetch_status,'HTTP 410 Gone');
assert.equal(r240.qualification_totals.verified_true_plus_wholesale_upstreams,0);

// R239: invitation-only claimed B2B wholesale is a lead, not an authenticated one-unit invoice-complete source.
const c239=d.records.find(x=>x.id==='gpt-source-followup-r239-20261119');
const e239=d.records.find(x=>x.id==='gpt-source-followup-r239-20261119-evidence');
assert(c239&&e239&&c239.url.endsWith('supplier-followup-20261119-r02.html'));
const r239=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-19/supplier-followup-20261119-r02-evidence.json'),'utf8'));
assert.equal(r239.round,239);assert.equal(r239.site_version,'1.9.247');
const b239=r239.discovery.newly_catalogued_public_first_party_candidate;
assert.equal(b239.accurate_public_plus_sku_name,'ChatGPT Plus · 月卡');
assert.equal(b239.merchant_indicates_price_visible_only_after_account_approval,true);
assert.equal(b239.approved_wholesale_price_cny_per_one_unit_one_month,null);
assert.equal(b239.no_agent_upfront_fee_verified,null);
assert.equal(b239.actual_refund_to_original_payment_method_verified,null);
assert.equal(r239.procurement_unknowns.all_required_costs_plus_chinese_vat_cny,null);
assert.equal(r239.qualification_totals.verified_true_plus_wholesale_upstreams,0);
assert.equal(r239.actual_purchase_made,false);assert.equal(r239.sms_test_done,false);


// R243: an indexed seller API spec is neither a live checkout nor a credential-free wholesale supplier.
const c243=d.records.find(x=>x.id==='gpt-source-followup-r243-20261119');
const e243=d.records.find(x=>x.id==='gpt-source-followup-r243-20261119-evidence');
assert(c243&&e243&&c243.url.endsWith('supplier-followup-20261119-r06.html'));
const r243=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-19/supplier-followup-20261119-r06-evidence.json'),'utf8'));
assert.equal(r243.round,243);assert.equal(r243.site_version,'1.9.251');
assert.equal(r243.material_observations[0].api_mandatory_chatgpt_session_token,true);
assert.equal(r243.material_observations[0].api_mandatory_payment_instrument,true);
assert.equal(r243.material_observations[0].direct_live_origin_content_verified,false);
assert.equal(r243.material_observations[0].actual_approved_one_unit_monthly_plus_wholesale_price_cny,null);
assert.equal(r243.procurement.verified_all_in_total_cny,null);
assert.equal(r243.qualification_totals.verified_true_plus_wholesale_upstreams,0);
assert.equal(r243.actual_purchase_made,false);


// R244: seller's tax-exclusive listed price cannot be mistaken for validated VAT-inclusive wholesale.
const c244=d.records.find(x=>x.id==='gpt-source-followup-r244-20261119');
const e244=d.records.find(x=>x.id==='gpt-source-followup-r244-20261119-evidence');
assert(c244&&e244&&c244.url.endsWith('supplier-followup-20261119-r07.html'));
const r244=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-19/supplier-followup-20261119-r07-evidence.json'),'utf8'));
assert.equal(r244.round,244);
assert.equal(r244.site_version,'1.9.252');
assert.equal(r244.material_observations[0].vendor_says_displayed_prices_exclude_tax,true);
assert.equal(r244.material_observations[0].invoice_fee_cny,null);
assert.equal(r244.material_observations[0].verified_all_in_cost_cny,null);
assert.equal(r244.procurement.verified_all_in_total_cny,null);
assert.equal(r244.qualification_totals.verified_true_plus_wholesale_upstreams,0);
assert.equal(r244.phone_verification.actual_sms_successes,0);
assert.equal(r244.actual_purchase_made,false);

// R245: vendor recharge warranty exclusion is not a verified SMS or one-unit wholesale promise.
const c245=d.records.find(x=>x.id==='gpt-source-followup-r245-20261119'),e245=d.records.find(x=>x.id==='gpt-source-followup-r245-20261119-evidence');
assert(c245&&e245&&c245.url.endsWith('supplier-followup-20261119-r08.html'));
const r245=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-19/supplier-followup-20261119-r08-evidence.json'),'utf8'));
assert.equal(r245.round,245);assert.equal(r245.site_version,'1.9.253');
assert.equal(r245.material_observations[0].vendor_excludes_phone_and_identity_verification_failure_from_recharge_warranty,true);
assert.equal(r245.material_observations[0].independent_codex_sms_failure_cash_refund,null);
assert.equal(r245.material_observations[1].session_is_password_level_credential,true);
assert.equal(r245.material_observations[2].rule_effective_date,null);
assert.equal(r245.procurement.verified_all_in_total_cny,null);
assert.equal(r245.qualification_totals.verified_true_plus_wholesale_upstreams,0);
assert.equal(r245.phone_verification.actual_sms_successes,0);
assert.equal(r245.actual_purchase_made,false);

// R246: independent ordering API is a vendor claim; old gptapi only activates prepaid CDKs.
const c246=d.records.find(x=>x.id==='gpt-source-followup-r246-20261119'),e246=d.records.find(x=>x.id==='gpt-source-followup-r246-20261119-evidence');
assert(c246&&e246&&c246.url.endsWith('supplier-followup-20261119-r09.html'));
const r246=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-19/supplier-followup-20261119-r09-evidence.json'),'utf8'));
assert.equal(r246.round,246);assert.equal(r246.site_version,'1.9.254');
assert.equal(r246.material_observations[0].vendor_explicitly_distinguishes_activation_api_and_ordering_api,true);
assert.equal(r246.material_observations[0].publicly_verified_order_endpoint_url,null);
assert.equal(r246.material_observations[1].activation_api_itself_is_not_purchase_api,true);
assert.equal(r246.material_observations[2].required_agent_entry_fee_cny,29.99);
assert.equal(r246.material_observations[2].valid_china_vat_invoice_fee_cny,null);
assert.equal(r246.procurement.verified_all_in_total_cny,null);
assert.equal(r246.qualification_totals.verified_true_plus_wholesale_upstreams,0);
assert.equal(r246.phone_verification.actual_sms_successes,0);
assert.equal(r246.actual_purchase_made,false);

// R247: newly observed merchant offer is retail, not verified wholesale or phone success.
const c247=d.records.find(x=>x.id==='gpt-source-followup-r247-20261120'),e247=d.records.find(x=>x.id==='gpt-source-followup-r247-20261120-evidence');
assert(c247&&e247&&c247.url.endsWith('supplier-followup-20261120.html'));
const r247=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-20/supplier-followup-20261120-evidence.json'),'utf8'));
assert.equal(r247.round,247);assert.equal(r247.site_version,'1.9.255');
assert.equal(r247.discovery[0].listed_retail_price_cny_per_account_month,138);
assert.equal(r247.discovery[0].checkout_total_verified,false);
assert.equal(r247.discovery[0].phone_vendor_claims_free_assistance,true);
assert.equal(r247.discovery[0].verification_success_tested,false);
assert.equal(r247.discovery[0].valid_chinese_vat_invoice_issuer,null);
assert.equal(r247.procurement.verified_all_in_total_cny,null);
assert.equal(r247.qualification_totals.verified_true_plus_wholesale_upstreams,0);
assert.equal(r247.phone_verification.actual_sms_successes,0);
assert.equal(r247.actual_purchase_made,false);

// R248: merchant-labelled Pro listing is neither a confirmed official tier nor paid receipt; Plus sourcing remains unverified.
const c248=d.records.find(x=>x.id==='gpt-source-followup-r248-20261120'),e248=d.records.find(x=>x.id==='gpt-source-followup-r248-20261120-evidence');
assert(c248&&e248&&c248.url.endsWith('supplier-followup-20261120-r02.html'));
const r248=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-20/supplier-followup-20261120-r02-evidence.json'),'utf8'));
assert.equal(r248.round,248);assert.equal(r248.site_version,'1.9.256');
assert.equal(r248.material_observations[0].listed_retail_price_cny_per_account_month,688);
assert.equal(r248.material_observations[0].pro_100_200_500_official_tier_mapping_verified,false);
assert.equal(r248.material_observations[0].real_paid_checkout_total_cny,null);
assert.equal(r248.material_observations[1].in_term_plus_renewal_verified,false);
assert.equal(r248.material_observations[2].shared_plus_sku_still_present,true);
assert.equal(r248.unchanged_observations[0].plus_price_change_from_round247,false);
assert.equal(r248.procurement.verified_plus_all_in_total_cny,null);
assert.equal(r248.qualification_totals.verified_true_plus_wholesale_upstreams,0);
assert.equal(r248.phone_verification.actual_sms_successes,0);
assert.equal(r248.actual_purchase_made,false);

// R249: vendor-specific in-term Pro upgrade credit is not a Plus wholesale offer, phone verification or paid success.
const c249=d.records.find(x=>x.id==='gpt-source-followup-r249-20261120'),e249=d.records.find(x=>x.id==='gpt-source-followup-r249-20261120-evidence');
assert(c249&&e249&&c249.url.endsWith('supplier-followup-20261120-r03.html'));
const r249=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-20/supplier-followup-20261120-r03-evidence.json'),'utf8'));
assert.equal(r249.round,249);assert.equal(r249.site_version,'1.9.257');
assert.equal(r249.material_observations[0].min_subscription_remaining_hours,72);
assert.equal(r249.material_observations[0].max_credit_days,28);
assert.equal(r249.material_observations[0].live_upgrade_checkout_total_cny,null);
assert.equal(r249.material_observations[1].vendor_explicitly_states_no_invoice,true);
assert.equal(r249.material_observations[1].purchase_phone_verification_refers_to_merchant_order_eligibility_not_openai_phone_binding,true);
assert.equal(r249.material_observations[2].listed_retail_cny_per_account_month,179);
assert.equal(r249.procurement.verified_plus_all_in_total_cny,null);
assert.equal(r249.qualification_totals.verified_true_plus_wholesale_upstreams,0);
assert.equal(r249.phone_verification.actual_sms_successes,0);
assert.equal(r249.actual_purchase_made,false);


// R250: separated invoice eligibility, no final paid total and site-balance-only SMS refund promise.
const c250=d.records.find(x=>x.id==='gpt-source-followup-r250-20261120'),e250=d.records.find(x=>x.id==='gpt-source-followup-r250-20261120-evidence');
assert(c250&&e250&&c250.url.endsWith('supplier-followup-20261120-r04.html'));
const r250=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-20/supplier-followup-20261120-r04-evidence.json'),'utf8'));
assert.equal(r250.round,250);assert.equal(r250.site_version,'1.9.258');
assert.equal(r250.material_observations[0].listed_price_cny_per_unit_month,128);
assert.equal(r250.material_observations[1].listed_promotional_price_cny_per_unit_month,158);
assert.equal(r250.material_observations[2].enterprise_plus_ph_one_month_cny_per_unit,179);
assert.equal(r250.material_observations[2].ordinary_retail_orders_invoice_supported_vendor_claim,false);
assert.equal(r250.material_observations[4].original_cash_route_refund_guaranteed,false);
assert.equal(r250.material_observations[4].openai_selected_number_price_cny,null);
assert.equal(r250.qualification_totals.verified_true_plus_wholesale_upstreams,0);
assert.equal(r250.actual_purchase_made,false);

// R251: 20x same-tier renewal preserves unused term only by vendor claim; no invoice and not Plus wholesale.
const c251=d.records.find(x=>x.id==='gpt-source-followup-r251-20261120'),e251=d.records.find(x=>x.id==='gpt-source-followup-r251-20261120-evidence');
assert(c251&&e251&&c251.url.endsWith('supplier-followup-20261120-r05.html'));
const r251=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-20/supplier-followup-20261120-r05-evidence.json'),'utf8'));
assert.equal(r251.round,251);assert.equal(r251.site_version,'1.9.259');
assert.equal(r251.material_observations[0].seller_labeled_price_cny_per_one_billing_month,1569);
assert.equal(r251.material_observations[0].earliest_order_window_days_before_expiry_vendor_claim,30);
assert.equal(r251.material_observations[0].active_subscription_unused_days_preserved_vendor_claim,true);
assert.equal(r251.material_observations[0].merchant_explicitly_excludes_invoices_for_this_sku,true);
assert.equal(r251.material_observations[0].actual_payable_checkout_total_cny,null);
assert.equal(r251.material_observations[0].actual_purchase_tested,false);
assert.equal(r251.procurement.observed_sku_is_plus,false);
assert.equal(r251.procurement.verified_plus_all_in_total_cny,null);
assert.equal(r251.phone_verification.actual_sms_successes,0);
assert.equal(r251.qualification_totals.verified_true_plus_wholesale_upstreams,0);
assert.equal(r251.actual_purchase_made,false);

// R252: merchant-disclosed issuer is not an independently confirmed company or genuine Chinese VAT invoice.
const c252=d.records.find(x=>x.id==='gpt-source-followup-r252-20261120'),e252=d.records.find(x=>x.id==='gpt-source-followup-r252-20261120-evidence');
assert(c252&&e252&&c252.url.endsWith('supplier-followup-20261120-r06.html'));
const r252=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-20/supplier-followup-20261120-r06-evidence.json'),'utf8'));
assert.equal(r252.round,252);assert.equal(r252.site_version,'1.9.260');
assert.equal(r252.material_observations[0].invoice_issuer_name_vendor_claim,'花衍科技（广州）有限公司');
assert.equal(r252.material_observations[0].invoice_taxpayer_id_vendor_claim,'91440104MAEP1N3U8F');
assert.equal(r252.material_observations[0].official_chinese_company_registry_verified,false);
assert.equal(r252.material_observations[0].real_chinese_vat_invoice_verified,false);
assert.equal(r252.material_observations[1].retail_cny_per_account_month,160);
assert.equal(r252.material_observations[1].actual_paid_total_cny,null);
assert.equal(r252.procurement.verified_all_fees_with_valid_china_vat_cny,null);
assert.equal(r252.qualification_totals.verified_true_plus_wholesale_upstreams,0);
assert.equal(r252.payment_done,false);

// R253: new subscription Pro500 listing and explicit non-invoice terms are distinct from 20x renewal.
const c253=d.records.find(x=>x.id==='gpt-source-followup-r253-20261120'),e253=d.records.find(x=>x.id==='gpt-source-followup-r253-20261120-evidence');
assert(c253&&e253&&c253.url.endsWith('supplier-followup-20261120-r07.html'));
const r253=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-20/supplier-followup-20261120-r07-evidence.json'),'utf8'));
assert.equal(r253.round,253);assert.equal(r253.site_version,'1.9.261');
assert.equal(r253.observations[0].vendor_displayed_price_cny,3889);
assert.equal(r253.observations[0].invoice_excluded_in_order_consent_vendor_claim,true);
assert.equal(r253.observations[0].checkout_paid_cny,null);
assert.equal(r253.observations[1].vendor_displayed_price_cny,1569);
assert.equal(r253.observations[2].order_window_days_before_expiration,30);
assert.equal(r253.observations[3].vendor_displayed_price_cny,179);
assert.equal(r253.procurement.complete_verified_plus_all_in_price_cny,null);
assert.equal(r253.qualification_totals.verified_true_plus_wholesale_upstreams,0);
assert.equal(r253.phone_verification.sms_success_test_count,0);
assert.equal(r253.payment_done,false);

// R254: accurately priced vendor Codex SMS package is not a verified refund, Plus wholesale or SMS success.
const c254=d.records.find(x=>x.id==='gpt-source-followup-r254-20261120'),e254=d.records.find(x=>x.id==='gpt-source-followup-r254-20261120-evidence');
assert(c254&&e254&&c254.url.endsWith('supplier-followup-20261120-r08.html'));
const r254=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-20/supplier-followup-20261120-r08-evidence.json'),'utf8'));
assert.equal(r254.round,254);assert.equal(r254.site_version,'1.9.262');
assert.equal(r254.observations[0].merchant_price_cny_per_cdk_item,8);
assert.equal(r254.observations[0].checkout_total_cny,null);
assert.equal(r254.observations[0].number_holding_days,null);
assert.equal(r254.observations[0].merchant_no_refund_after_sale_except_invalid_cdk,true);
assert.equal(r254.observations[1].vendor_homepage_retail_price_cny_per_cdk,118);
assert.equal(r254.procurement.verified_plus_all_in_cny,null);
assert.equal(r254.qualification_totals.verified_true_plus_wholesale_upstreams,0);
assert.equal(r254.phone_verification.actual_sms_successes,0);
assert.equal(r254.payment_done,false);

// R255: first-party Pro prices are not eligible Plus wholesale or tested checkout.
const c255=d.records.find(x=>x.id==='gpt-source-followup-r255-20261120'),e255=d.records.find(x=>x.id==='gpt-source-followup-r255-20261120-evidence');
assert(c255&&e255&&c255.url.endsWith('supplier-followup-20261120-r09.html'));
const r255=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-20/supplier-followup-20261120-r09-evidence.json'),'utf8'));
assert.equal(r255.round,255);assert.equal(r255.site_version,'1.9.263');
assert.equal(r255.observations[0].seller_listed_cny_per_account_month,800);
assert.equal(r255.observations[1].seller_listed_cny_per_account_month,1400);
assert.equal(r255.observations[2].seller_listed_cny_per_account_month,null);
assert.equal(r255.observations[3].already_archived,true);
assert.equal(r255.plus_procurement.verified_all_in_cny,null);
assert.equal(r255.qualification_totals.verified_true_plus_wholesale_upstreams,0);
assert.equal(r255.phone_verification.actual_sms_successes,0);
assert.equal(r255.payment_done,false);

 // R256: first-party Nov 19 merchant FAQ refines delivery/refund expectations, not a confirmed price change or tested transaction.
 const c256=d.records.find(x=>x.id==='gpt-source-followup-r256-20261120'),e256=d.records.find(x=>x.id==='gpt-source-followup-r256-20261120-evidence');
 assert(c256&&e256&&c256.url.endsWith('supplier-followup-20261120-r10.html'));
 const r256=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-20/supplier-followup-20261120-r10-evidence.json'),'utf8'));
 assert.equal(r256.round,256);assert.equal(r256.site_version,'1.9.264');
 assert.equal(r256.observations[0].merchant_disclaims_fixed_delivery_minutes,true);
 assert.equal(r256.observations[0].actual_delivery_minutes_verified,null);
 assert.equal(r256.observations[1].merchant_says_first_code_activation_or_validation_within_hours,24);
 assert.equal(r256.observations[1].actual_cash_route_refund_verified,false);
 assert.equal(r256.observations[2].seller_landing_list_cny_per_account_month,179);
 assert.equal(r256.observations[2].price_change_verified,false);
 assert.equal(r256.plus_procurement.verified_all_in_cny,null);
 assert.equal(r256.qualification_totals.verified_true_plus_wholesale_upstreams,0);
 assert.equal(r256.phone_verification.actual_sms_successes,0);
 assert.equal(r256.payment_done,false);

// R257: Pro allowance policy announcement date differs from present research date; seller SKU unverified.
const c257=d.records.find(x=>x.id==='gpt-source-followup-r257-20261120'),e257=d.records.find(x=>x.id==='gpt-source-followup-r257-20261120-evidence');
assert(c257&&e257&&c257.url.endsWith('supplier-followup-20261120-r11.html'));
const r257=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-20/supplier-followup-20261120-r11-evidence.json'),'utf8'));
assert.equal(r257.round,257);assert.equal(r257.site_version,'1.9.265');
assert.equal(r257.observations[0].official_announcement_on,'2026-10-29');
assert.equal(r257.observations[2].earlier_low_allowance_doubled_to_high,true);
assert.equal(r257.observations[3].pro500_only_ultrafast,true);
assert.equal(r257.plus_procurement.verified_all_in_cny,null);
assert.equal(r257.qualification_totals.verified_true_plus_wholesale_upstreams,0);
assert.equal(r257.phone_verification.actual_sms_successes,0);
assert.equal(r257.payment_done,false);

// R258: official API phone cap is not an SMS success or an invoiced wholesale claim.
const c258=d.records.find(x=>x.id==='gpt-source-followup-r258-20261120'),e258=d.records.find(x=>x.id==='gpt-source-followup-r258-20261120-evidence');
assert(c258&&e258&&c258.url.endsWith('supplier-followup-20261120-r12.html'));
const r258=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-20/supplier-followup-20261120-r12-evidence.json'),'utf8'));
assert.equal(r258.round,258);assert.equal(r258.site_version,'1.9.266');
assert.equal(r258.observations[0].same_phone_total_verifications_max,3);
assert.equal(r258.observations[0].same_cap_applies_to_codex_verified,null);
assert.equal(r258.observations[1].actual_payee_legal_entity_verified,null);
assert.equal(r258.observations[1].seller_distinguishes_pdf_invoice_from_china_vat,true);
assert.equal(r258.qualification_totals.verified_true_plus_wholesale_upstreams,0);
assert.equal(r258.phone_verification.actual_sms_successes,0);

// R259 first-read ChongPay card labels are seller retail observations only.
const c259=d.records.find(x=>x.id==='gpt-source-followup-r259-20261120'),e259=d.records.find(x=>x.id==='gpt-source-followup-r259-20261120-evidence');
assert(c259&&e259&&c259.url.endsWith('supplier-followup-20261120-r13.html'));
const r259=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-20/supplier-followup-20261120-r13-evidence.json'),'utf8'));
assert.equal(r259.round,259);assert.equal(r259.site_version,'1.9.267');
assert.deepEqual(r259.observations[0].sku.map(x=>x.listed_cny_per_card),[729,1188,3299]);
assert.deepEqual(r259.observations[0].sku.map(x=>x.supplier_multiplier_label),['5×','10×','25×']);
assert.equal(r259.observations[0].verified_same_sku_repricing_today,false);
assert.equal(r259.observations[0].sku[0].checkout_total_cny,null);
assert.equal(r259.observations[1].valid_china_vat_issuer,null);
assert.equal(r259.qualification_totals.verified_true_plus_wholesale_upstreams,0);
assert.equal(r259.phone_verification.actual_sms_successes,0);
assert.equal(r259.payment_done,false);

// R260: first-read Pro monthly labels and Pro invoice terms are seller claims, not qualifying wholesale.
const c260=d.records.find(x=>x.id==='gpt-source-followup-r260-20261121'),e260=d.records.find(x=>x.id==='gpt-source-followup-r260-20261121-evidence');
assert(c260&&e260&&c260.url.endsWith('supplier-followup-20261121.html'));
const r260=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-21/supplier-followup-20261121-evidence.json'),'utf8'));
assert.equal(r260.round,260);assert.equal(r260.site_version,'1.9.268');
assert.deepEqual(r260.observations[0].sku.map(x=>x.listed_cny_per_account_month),[710,1230,3380]);
assert.equal(r260.observations[0].same_sku_repricing_verified,false);
assert.equal(r260.observations[1].seller_claim_pro_invoice_extra_cny,50);
assert.equal(r260.observations[1].invoice_issuer_legal_entity,null);
assert.equal(r260.plus_procurement.verified_all_in_cny,null);
assert.equal(r260.qualification_totals.verified_true_plus_wholesale_upstreams,0);
assert.equal(r260.phone_verification.actual_sms_successes,0);
assert.equal(r260.payment_done,false);

// R262: current first-party SKU names, historic checkout caveats, separate third-party SMS.
const r262cat=d.records.find(x=>x.id==='gpt-source-followup-r262-20261121'),r262data=d.records.find(x=>x.id==='gpt-source-followup-r262-20261121-evidence');
assert(r262cat&&r262data&&r262cat.url.endsWith('supplier-followup-20261121-r03.html'));
const r262=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-21/supplier-followup-20261121-r03-evidence.json'),'utf8'));
assert.equal(r262.round,262);assert.equal(r262.site_version,'1.9.270');
assert.deepEqual(r262.first_party_observations.map(x=>x.seller_sku_id),[27,28,29,30]);
assert.deepEqual(r262.first_party_observations.map(x=>x.list_price_cny_per_account_month),[139.99,749.99,1349.99,3749.99]);
assert.equal(r262.seller_conditions.legal_chinese_vat_issuer,null);
assert.equal(r262.seller_conditions.dated_sku_rename_or_repricing_proven,false);
assert.equal(r262.phone_verification_lead.seller_first_party_price_verified_cny,null);
assert.equal(r262.phone_verification_lead.original_page_status,'captcha_only_unreadable');
assert.equal(r262.plus_criteria.verified_true_wholesale_upstreams,0);
assert.equal(r262.plus_criteria.actual_sms_successes,0);
assert.equal(r262.payment_done,false);

// R263: First-party APIHub invoice conditions are conflicting SKU claims, not VAT verification.
const r263catalog=d.records.find(x=>x.id==='gpt-source-followup-r263-20261121');
const r263data=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-21/supplier-followup-20261121-r04-evidence.json'),'utf8'));
assert(r263catalog&&r263catalog.url.endsWith('supplier-followup-20261121-r04.html'));
assert.equal(r263data.round,263);assert.equal(r263data.site_version,'1.9.271');
assert.deepEqual(r263data.first_party_observations.map(x=>x.sku),['G49307465','G34816878','G49852965']);
assert.deepEqual(r263data.first_party_observations.map(x=>x.merchant_claim_invoice_extra_cny),[35,50,null]);
assert.equal(r263data.first_party_observations[0].stock,'sold_out');
assert.equal(r263data.merchant_shop.conflicts_with_two_product_invoice_addon_claims,true);
assert.equal(r263data.merchant_shop.payment_fee_cny,null);
assert.equal(r263data.qualification.verified_true_wholesale_upstreams,0);
assert.equal(r263data.qualification.real_sms_successes,0);
assert.equal(r263data.payment_done,false);

// R265 retail origin and invoice terms, with unknown full fees and unverified SMS.
const r265catalog=d.records.find(x=>x.id==='gpt-source-followup-r265-20261121');
const r265data=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-21/supplier-followup-20261121-r06-evidence.json'),'utf8'));
assert(r265catalog&&r265catalog.url.endsWith('supplier-followup-20261121-r06.html'));
assert.equal(r265data.round,265);assert.equal(r265data.site_version,'1.9.273');
assert.deepEqual(r265data.merchant_observations.map(x=>x.merchant_list_price_cny),[160,129]);
assert.equal(r265data.tax_and_wholesale[0].merchant_claims_invoice_extra_cny_for_1_to_4_units,0);
assert.equal(r265data.tax_and_wholesale[0].actual_invoice_verified,false);
assert.equal(r265data.tax_and_wholesale[1].merchant_invoice_extra_cny,null);
assert.equal(r265data.qualification.verified_true_plus_wholesale_upstreams,0);
assert.equal(r265data.qualification.actual_all_in_cny,null);
assert.equal(r265data.phone_verification.real_sms_successes,0);
assert.equal(r265data.real_payment_done,false);

// R266: Provenance correction checks both previously archived vendors and the actual first-round dates.
const r266cat=d.records.find(x=>x.id==='gpt-source-followup-r266-20261121');
const r266dataset=d.records.find(x=>x.id==='gpt-source-followup-r266-20261121-evidence');
assert(r266cat&&r266dataset&&r266cat.url.endsWith('supplier-followup-20261121-r07.html'));
const r266=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-21/supplier-followup-20261121-r07-evidence.json'),'utf8'));
assert.equal(r266.round,266);assert.equal(r266.site_version,'1.9.274');
assert.deepEqual(r266.prior_direct_evidence.map(x=>x.first_round||x.first_round_for_current_seller_claim),[252,252,80,230]);
assert.equal(r266.prior_erratum.round,192);
assert.equal(r266.new_vendor_added,false);assert.equal(r266.new_primary_price_change_confirmed,false);
assert.equal(r266.qualification.verified_true_plus_wholesale_upstreams,0);
assert.equal(r266.qualification.actual_total_cny,null);assert.equal(r266.sms.actual_sms_successes,0);
assert.equal(r266.no_payment,true);assert.equal(r266.no_merchant_contact,true);

// R267: same exact merchant original-account Plus selector display differs across dated snapshots, not verified actual repricing/checkout.
const r267cat=d.records.find(x=>x.id==='gpt-source-followup-r267-20261121'),r267ev=d.records.find(x=>x.id==='gpt-source-followup-r267-20261121-evidence');
assert(r267cat&&r267ev&&r267cat.url.endsWith('supplier-followup-20261121-r08.html'));
const r267=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-21/supplier-followup-20261121-r08-evidence.json'),'utf8'));
assert.equal(r267.round,267);assert.equal(r267.site_version,'1.9.275');
assert.deepEqual([r267.material_observation.previously_directly_read.with_30_day_warranty_cny,r267.material_observation.previously_directly_read.without_warranty_cny],[145,135]);
assert.deepEqual([r267.material_observation.directly_read_this_round.with_30_day_warranty_cny,r267.material_observation.directly_read_this_round.without_warranty_cny],[155,145]);
assert.equal(r267.material_observation.effective_date_of_price_change_confirmed,null);
assert.equal(r267.invoice_and_resale.actual_all_required_fees_including_valid_china_vat_cny,null);
assert.equal(r267.invoice_and_resale.seller_agent_entry_fee_cny,3000);
assert.equal(r267.qualification.verified_true_plus_wholesale_upstreams,0);
assert.equal(r267.phone_verification.actual_sms_successes,0);
assert.equal(r267.actual_purchase_done,false);
// R268: seller bulk units cannot be mistaken for one-piece genuine VAT-invoiced wholesale.
const c268=d.records.find(x=>x.id==='gpt-source-followup-r268-20261121');
const e268=d.records.find(x=>x.id==='gpt-source-followup-r268-20261121-evidence');
assert(c268&&e268&&c268.url.endsWith('supplier-followup-20261121-r09.html'));
const r268=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-21/supplier-followup-20261121-r09-evidence.json'),'utf8'));
assert.equal(r268.round,268);
assert.equal(r268.site_version,'1.9.276');
assert.deepEqual(r268.listed_unit_prices.map(x=>x.same_sku_min_order_qty),[1,5,20,200]);
assert.deepEqual(r268.listed_unit_prices.map(x=>x.cny_per_account_month),[95,90,83,71]);
assert.equal(r268.contradicts_older_first_party_guidance.actual_change_date_verified,null);
assert.equal(r268.independently_verified_genuine_one_unit_wholesale_price_cny,null);
assert.equal(r268.all_required_payment_and_valid_chinese_vat_invoice_cny,null);
assert.equal(r268.buyer_resale_prohibited,true);
assert.equal(r268.qualification.verified_true_plus_wholesale_upstreams,0);
assert.equal(r268.qualification.real_sms_successes,0);
assert.equal(r268.actual_paid_order,false);
assert.equal(r268.credentials_submitted,false);

// R269: independently identified first-party CatFK stall, exact SKU pre-submit fee, and no VAT/wholesale leap.
const r269record=d.records.find(x=>x.id==='gpt-source-followup-r269-20261122');
const r269e=d.records.find(x=>x.id==='gpt-source-followup-r269-20261122-evidence');
assert(r269record&&r269e&&r269record.url.endsWith('supplier-followup-20261122.html'));
const r269=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-22/supplier-followup-20261122-evidence.json'),'utf8'));
assert.equal(r269.round,269);assert.equal(r269.site_version,'1.9.277');
assert.equal(r269.plus_sku.display_price_cny_per_account_month,138);
assert.equal(r269.plus_sku.payment_preview_fee_cny,2.48);
assert.equal(r269.plus_sku.payment_preview_total_cny,140.48);
assert.equal(r269.plus_sku.all_required_payment_and_valid_china_vat_invoice_cny,null);
assert.equal(r269.plus_sku.session_or_token_required_on_product_page,null);
assert.equal(r269.independent_sms.payment_preview_total_cny,2.04);
assert.equal(r269.independent_sms.failed_receive_cash_refund_verified,false);
assert.equal(r269.qualification.verified_true_plus_wholesale_upstreams,0);
assert.equal(r269.qualification.actual_sms_successes,0);

// R270: exact CatFK SKU, invoice fee caveat and distinct alternate-shop Session policy.
const r270record=d.records.find(x=>x.id==='gpt-source-followup-r270-20261122');
const r270e=d.records.find(x=>x.id==='gpt-source-followup-r270-20261122-evidence');
assert(r270record&&r270e&&r270record.url.endsWith('supplier-followup-20261122-r02.html'));
const r270=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-22/supplier-followup-20261122-r02-evidence.json'),'utf8'));
assert.equal(r270.round,270);assert.equal(r270.site_version,'1.9.278');
assert.equal(r270.plus_sku.listed_cny_per_one_account_month,120);
assert.equal(r270.plus_sku.unpaid_preview_fee_cny,2.16);
assert.equal(r270.plus_sku.unpaid_preview_total_cny,122.16);
assert.equal(r270.plus_sku.seller_china_invoice_extra_percent_claim,6);
assert.equal(r270.plus_sku.valid_china_vat_total_cost_cny,null);
assert.equal(r270.plus_sku.session_cookie_token_required_for_this_exact_sku,null);
assert.equal(r270.alternate_shop.session_cookie_requested_on_that_other_sku,true);
assert.equal(r270.merchant.china_vat_issuer_verified,null);
assert.equal(r270.qualification.verified_true_plus_wholesale_upstreams,0);
assert.equal(r270.qualification.actual_plus_purchases,0);
assert.equal(r270.phone_verification.real_sms_successes,0);

// R271: first-party invoice/payee mismatch vs third-party SMS snapshots (not official phone-policy change).
const r271r=d.records.find(x=>x.id==='gpt-source-followup-r271-20261122');
const r271e=d.records.find(x=>x.id==='gpt-source-followup-r271-20261122-evidence');
assert(r271r&&r271e&&r271r.url.endsWith('supplier-followup-20261122-r03.html'));
const r271=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-22/supplier-followup-20261122-r03-evidence.json'),'utf8'));
assert.equal(r271.round,271); assert.equal(r271.site_version,'1.9.279');
assert.equal(r271.new_merchant.seller_announcement_invoice_payee_mismatch,true);
assert.equal(r271.new_merchant.exact_one_piece_price_cny,null);
assert.equal(r271.new_merchant.verified_chinese_vat_invoice_total_cny,null);
assert.equal(r271.sms_reference_products[0].reference_price_cny,0.53);
assert.equal(r271.sms_reference_products[1].reference_price_cny,5.44);
assert.equal(r271.sms_reference_products[0].original_read_status,'waf_blocked');
assert.equal(r271.sms_reference_products[1].openai_policy_change_verified,false);
assert.equal(r271.qualification.verified_true_plus_wholesale_upstreams,0);
assert.equal(r271.qualification.actual_sms_successes,0);

// R272: two distinct first-party one-month Plus SKUs, only one with unpaid fee.
const r272rec=d.records.find(x=>x.id==='gpt-source-followup-r272-20261122');
const r272ev=d.records.find(x=>x.id==='gpt-source-followup-r272-20261122-evidence');
assert(r272rec&&r272ev&&r272rec.url.endsWith('supplier-followup-20261122-r04.html'));
const r272=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-22/supplier-followup-20261122-r04-evidence.json'),'utf8'));
assert.equal(r272.round,272);assert.equal(r272.site_version,'1.9.280');
assert.equal(r272.merchant.store_id,'S747438');
assert.deepEqual(r272.plus_skus.map(x=>x.sku),['G55968486','G39144461']);
assert.deepEqual(r272.plus_skus.map(x=>x.listed_price_cny_per_one_account_month),[112.06,112.06]);
assert.equal(r272.plus_skus[0].unpaid_checkout_fee_cny,3.1377);
assert.equal(r272.plus_skus[0].unpaid_checkout_total_screen_cny,115.20);
assert.equal(r272.plus_skus[1].unpaid_checkout_fee_cny,null);
assert.equal(r272.plus_skus[0].all_required_payment_plus_valid_china_vat_cny,null);
assert.equal(r272.merchant.seller_says_china_vat_invoice_separate_quote,true);
assert.equal(r272.merchant.one_piece_genuine_wholesale_price_cny,null);
assert.equal(r272.qualification.verified_true_plus_wholesale_upstreams,0);
assert.equal(r272.qualification.real_valid_china_vat_invoice_verifications,0);
assert.equal(r272.qualification.real_sms_successes,0);

// R273: new retail seller disclosure, standalone SMS credit and manual-vs-automation separation.
const r273rec=d.records.find(x=>x.id==='gpt-source-followup-r273-20261122');
const r273ev=d.records.find(x=>x.id==='gpt-source-followup-r273-20261122-evidence');
assert(r273rec&&r273ev&&r273rec.url.endsWith('supplier-followup-20261122-r05.html'));
const r273=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-22/supplier-followup-20261122-r05-evidence.json'),'utf8'));
assert.equal(r273.round,273);assert.equal(r273.site_version,'1.9.281');
assert.equal(r273.new_retail_candidate.listed_price_cny_per_account_month,135);
assert.equal(r273.new_retail_candidate.exact_plus_payment_sku,null);
assert.equal(r273.new_retail_candidate.total_required_payment_with_valid_china_vat_cny,null);
assert.equal(r273.new_retail_candidate.session_json_required_at_redemption,true);
assert.equal(r273.new_retail_candidate.shared_domain_proves_same_real_upstream,false);
assert.equal(r273.new_independent_phone_verification.merchant_advertised_price_cny_per_one_credit,0.75);
assert.equal(r273.new_independent_phone_verification.linked_sku,'G67624440');
assert.equal(r273.new_independent_phone_verification.linked_original_product_page_readable,false);
assert.equal(r273.new_independent_phone_verification.manual_vip_region_success_debit_credits,2);
assert.equal(r273.new_independent_phone_verification.auto_mode_may_request_email_optional_password_2fa_and_mail_code,true);
assert.equal(r273.qualification.verified_true_plus_wholesale_upstreams,0);
assert.equal(r273.qualification.actual_plus_purchases,0);
assert.equal(r273.qualification.real_sms_successes,0);

// Round 274: original product SKU and itemised invoice surcharge must not become verified paid VAT cost.
const r274rec=d.records.find(x=>x.id==='gpt-source-followup-r274-20261122');
const r274ev=d.records.find(x=>x.id==='gpt-source-followup-r274-20261122-evidence');
assert(r274rec&&r274ev&&r274rec.url.endsWith('supplier-followup-20261122-r06.html'));
const r274=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-22/supplier-followup-20261122-r06-evidence.json'),'utf8'));
assert.equal(r274.round,274);assert.equal(r274.site_version,'1.9.282');
assert.equal(r274.new_retail_candidate.exact_sku,'G25645664');
assert.equal(r274.new_retail_candidate.first_party_visible_price_cny,122);
assert.equal(r274.new_retail_candidate.processing_fee_cny,null);
assert.equal(r274.new_retail_candidate.merchant_claim_invoice_surcharge_cny,50);
assert.equal(r274.new_retail_candidate.arithmetic_price_plus_merchant_claim_invoice_surcharge_cny,172);
assert.equal(r274.new_retail_candidate.actual_full_payment_including_verified_china_vat_cny,null);
assert.equal(r274.new_retail_candidate.session_or_token_requirement_verified_for_this_sku,null);
assert.equal(r274.qualification.verified_true_plus_wholesale_upstreams,0);
assert.equal(r274.qualification.actual_plus_purchases,0);
assert.equal(r274.qualification.verified_china_vat_invoices,0);
assert.equal(r274.qualification.real_sms_successes,0);

// R275: same seller / same Plus SKU, separate observed-on dates; no stock or payment/phone success claimed.
const r275rec=d.records.find(x=>x.id==='gpt-source-followup-r275-20261123');
const r275ev=d.records.find(x=>x.id==='gpt-source-followup-r275-20261123-evidence');
assert(r275rec&&r275ev&&r275rec.url.endsWith('supplier-followup-20261123.html'));
const r275=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-23/supplier-followup-20261123-evidence.json'),'utf8'));
assert.equal(r275.round,275);assert.equal(r275.site_version,'1.9.283');
assert.equal(r275.historical_source.observed_on,'2026-11-06');
assert.equal(r275.current_original_product.observed_on,'2026-11-23');
assert.deepEqual([r275.historical_source.ordinary_channel1_cny_per_account_month,r275.historical_source.ordinary_channel3_ios_cny_per_account_month],[110,120]);
assert.deepEqual([r275.current_original_product.ordinary_channel1_cny_per_account_month,r275.current_original_product.ordinary_channel3_ios_cny_per_account_month],[111,128]);
assert.equal(r275.current_original_product.listed_stock_quantity,0);
assert.equal(r275.current_original_product.seller_claims_preorder_cancel_to_original_payment_has_percent_fee,10);
assert.equal(r275.current_original_product.full_actual_cost_with_verified_china_vat_invoice_cny,null);
assert.equal(r275.public_snapshot_difference.merchant_price_change_effective_date,null);
assert.equal(r275.qualification.verified_true_plus_wholesale_upstreams,0);
assert.equal(r275.qualification.real_sms_successes,0);

// Round 277: public agent entry fee violates the no-upfront hard constraint.
const r277rec=d.records.find(x=>x.id==='gpt-source-followup-r277-20261123');
const r277ev=d.records.find(x=>x.id==='gpt-source-followup-r277-20261123-evidence');
assert(r277rec&&r277ev&&r277rec.url.endsWith('supplier-followup-20261123-r03.html'));
const r277=JSON.parse(fs.readFileSync(path.join(root,'dist/research/2026-11-23/supplier-followup-20261123-r03-evidence.json'),'utf8'));
assert.equal(r277.round,277);
assert.equal(r277.site_version,'1.9.285');
assert.equal(r277.candidate.retail_display_price_cny,119);
assert.equal(r277.candidate.agent_display_price_cny,115);
assert.equal(r277.candidate.required_agent_upfront_fee_cny,29.99);
assert.equal(r277.candidate.all_in_cost_including_valid_china_VAT_cny,null);
assert.equal(r277.candidate.no_upfront_agent_fee_requirement_satisfied,false);
assert.equal(r277.delivery_and_verification.merchant_TOTP_tool_is_not_phone_SMS,true);
assert.equal(r277.activation_domain_crosscheck.direct_page_chatgpt_plus_maintenance_notice,true);
assert.equal(r277.activation_domain_crosscheck.exact_Seller_API_endpoint_status_confirmed,null);
assert.equal(r277.qualification.verified_true_plus_wholesale_upstreams,0);
