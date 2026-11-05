"""Check publication byte preservation, local links, evidence boundaries and catalogue mappings."""
import hashlib
import base64
import json
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
from build_publications import PUBLICATIONS
from validate_archive import scan
from validate_publication_archive import validate_publication_archive

ROOT = Path(__file__).resolve().parents[1]


class Document(HTMLParser):
    def __init__(self):
        super().__init__(); self.ids = set(); self.links = []; self.images = []; self.downloads = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs:
            assert attrs['id'] not in self.ids, 'Duplicate publication anchor'
            self.ids.add(attrs['id'])
        if tag == 'a':
            self.links.append(attrs.get('href', ''))
            if 'download' in attrs: self.downloads.append(attrs.get('href', ''))
        if tag == 'img' and attrs.get('src'):
            src = attrs['src']
            assert src.startswith('data:image/png;base64,'), 'Only reviewed embedded PNG previews'
            payload = base64.b64decode(src.split(',', 1)[1], validate=True)
            assert payload.startswith(b'\x89PNG\r\n\x1a\n') and len(payload) < 1500000
            self.images.append(hashlib.sha256(payload).hexdigest())
        elif tag in {'script', 'iframe', 'img', 'audio', 'video', 'source'}:
            assert not attrs.get('src'), 'Unexpected runtime resource'
        if tag == 'link': assert attrs.get('rel') not in {'stylesheet', 'preload', 'modulepreload'}


def validate_publications():
    for name, digest in PUBLICATIONS:
        source = (ROOT / 'publications' / name).read_bytes()
        output = (ROOT / 'dist' / name).read_bytes()
        assert output == source and hashlib.sha256(output).hexdigest() == digest
        if name.endswith('.zip'):
            validate_publication_archive(output, name)
            continue
        text = output.decode('utf-8'); scan(text)
        assert all(term not in text for term in ('libfile_', '/workspace/', 'file_000000'))
        if name.endswith('.html'):
            doc = Document(); doc.feed(text)
            if name == 'research/2026-10-03/supplier-review-original.html':
                # Byte-preserved historical download, not the catalogue reading entry.
                assert digest == 'cf41c5bbeae9987c7c73d50c874aa29847d1ac0252e18a15ce3d375181554054'
                reader = Document(); reader.feed((ROOT / 'dist/research/2026-10-03/index.html').read_text(encoding='utf-8'))
                raw_links = [link for link in reader.links if link == 'supplier-review-original.html']
                assert raw_links and len(raw_links) == reader.downloads.count('supplier-review-original.html')
                assert '../../dashboard/index.html' in reader.links
                catalog = json.loads((ROOT / 'dist/dashboard/catalog.json').read_bytes())
                assert not any('supplier-review-original.html' in record['url'] for record in catalog['records'])
            else:
                assert '../../dashboard/index.html' in doc.links, 'Publication has no workbench return'
            assert len(doc.images) == (3 if name == 'research/ai-side-income/report.html' else 0)
            for href in doc.links:
                url = urlsplit(href)
                assert url.scheme not in {'javascript', 'data'}
                if url.scheme: continue
                target = (((ROOT / 'dist' / name).parent / url.path) if url.path else ROOT / 'dist' / name).resolve()
                assert target.is_relative_to((ROOT / 'dist').resolve()) and target.is_file(), href
                if url.fragment:
                    target_doc = doc
                    if url.path:
                        assert target.suffix == '.html', href
                        target_doc = Document(); target_doc.feed(target.read_text(encoding='utf-8'))
                    assert url.fragment in target_doc.ids, href

    upstream = json.loads((ROOT / 'dist/research/round3-7/ai-upstream-public.json').read_bytes())
    assert upstream['current_view']['new_qualified_candidate_ranking'] == []
    assert len(upstream['current_view']['research_leads_not_ranking']) == 8
    history = upstream['price_history']
    assert len(history) == len({item['history_id'] for item in history}) == 30
    assert len(upstream['source_catalog']) == 273
    assert len(upstream['evidence_chapters']) == 9
    prior_chapters = {key: upstream['evidence_chapters'][key] for key in ['r3_invoice', 'r3_claude', 'r3_entry', 'r4', 'r5', 'r6', 'r7']}
    assert len(upstream['correction_log']) == 32
    canonical = lambda value: json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()
    old_chapters = {key: value for key, value in upstream['evidence_chapters'].items() if key != 'invoice_authority_20261003'}
    assert hashlib.sha256(canonical(old_chapters)).hexdigest() == '402b2d2d76fa7dbdc34f2e3a5e0f446117306ff91ad92612859b9a987d9d82b3', 'Prior eight chapters changed'
    invoice = upstream['evidence_chapters']['invoice_authority_20261003']
    assert len(invoice['supplier_matrix']) == 7 and len(invoice['sources']) == 32
    assert all(row[key] is False for row in invoice['supplier_matrix'] for key in ['actual_invoice_verified', 'invoice_transaction_match_verified', 'upstream_qualified'])
    assert upstream['invoice_evidence_delta']['url_index_additions'] == 16
    assert upstream['invoice_evidence_delta']['actual_invoices_verified'] == upstream['invoice_evidence_delta']['new_qualified_upstreams'] == 0
    assert hashlib.sha256(canonical(prior_chapters)).hexdigest() == 'e98c37596997828c3d62599915f456fec285d63d4a081f5954673a64a11b17ea'
    for key, expected in [('price_history', '77f5c9a04e1749cc39adb710713b65cfa455fe4ef33b41e878cb22df2b240a12'), ('current_view', 'befaa5f8bdeec7cac8b5df62cbc815c29f37cee3239d67db1c511ef123ed83d9')]:
        assert hashlib.sha256(canonical(upstream[key])).hexdigest() == expected, 'Prior research meaning changed'
    assert hashlib.sha256(canonical(upstream['correction_log'][:23])).hexdigest() == '9e02241cea1020d5b84dd62b0023ee16b4cd570f305ed69cd29d43b5dd6c397b'
    side = json.loads((ROOT / 'dist/research/ai-side-income/data.json').read_bytes())
    page = (ROOT / 'dist/research/ai-side-income/report.html').read_text(encoding='utf-8')
    embedded = re.search(r'<script[^>]*id="report-data"[^>]*>(.*?)</script>', page, re.S)
    assert embedded and json.loads(embedded.group(1)) == side
    assert side['report_version'] == '1.4' and len(side['options']) == 32 and len(side['sources']) == 153
    for key, digest in [('options', 'ad2c390b4189bd4137b4d8e2e547bf1366fc1103ef0005904daeee2c2749a83b'), ('sources', 'd8b1e5dfc87e45fa35d4b0da758c49098726f78e405512154532bf5b59442fa5'), ('workflow_sample', '8ced36ccef10d3f5f7ac0a799ad1a59d08821ff9f7d853ff62dfc5b67b1b197c')]:
        assert hashlib.sha256(canonical(side[key])).hexdigest() == digest, 'Existing side-income evidence changed'
    status = side['validation']
    assert status['samples_created'] is True and status['created_sample_count'] == 1
    assert status['created_sample_family_ids'] == ['C10'] and status['other_product_samples_created'] is False
    assert status['real_sales_verified'] is False and status['real_account_payout_verified'] is False
    assert status['sample_independent_user_tested'] is False and status['sample_paid_orders_observed'] == 0
    assert status['sample_native_excel_tested'] is False and status['sample_native_calc_xlsx_recalculation'] is False
    sample = side['workflow_sample']
    assert sample['sample_created'] is True and sample['sample_is_formal_product'] is False
    target = sample['website_integration']['download_target']
    zip_bytes = (ROOT / 'dist/research/ai-side-income/sample-v0.1.zip').read_bytes()
    assert target['bytes'] == len(zip_bytes) == 66163
    assert target['sha256'] == hashlib.sha256(zip_bytes).hexdigest()
    candidate = side['workflow_sample_v02']
    assert candidate['family_id'] == 'C10' and candidate['new_product_family'] is False
    assert candidate['sample_is_formal_product'] is False and candidate['paid_orders_observed'] == 0
    assert all(candidate[key] is False for key in ['native_excel_tested', 'native_calc_xlsx_recalculation_passed', 'independent_user_tested', 'real_sales_verified'])
    candidate_bytes = (ROOT / 'dist/research/ai-side-income/sample-v0.2-candidate.zip').read_bytes()
    assert candidate['download']['href'] == 'sample-v0.2-candidate.zip'
    assert candidate['download']['bytes'] == len(candidate_bytes) == 60354
    assert candidate['download']['sha256'] == hashlib.sha256(candidate_bytes).hexdigest()
    assert candidate['download']['recursive_member_count'] == 40 and len(candidate['program_tests']) == 21
    catalog = json.loads((ROOT / 'dist/dashboard/catalog.json').read_bytes())
    by_id = {record['id']: record for record in catalog['records']}
    assert by_id['upstream-round3-7']['task'] == 'project-1'
    assert by_id['side-income-report']['task'] == 'project-17'
    assert by_id['side-income-data']['task'] == 'project-17'
    assert by_id['side-income-sample-v01']['task'] == 'project-17'
    assert by_id['side-income-sample-v01']['url'] == '../research/ai-side-income/sample-v0.1.zip'
    assert by_id['side-income-sample-v02-candidate']['task'] == 'project-17'
    assert by_id['side-income-sample-v02-candidate']['url'] == '../research/ai-side-income/sample-v0.2-candidate.zip'
    assert catalog['counts'] == {'artifacts': 145, 'websites': 6, 'tasks': 18}
    manifest = json.loads((ROOT / 'dist/release-manifest.json').read_bytes())
    latest = manifest['latestResearchSupplement']
    assert latest['version'] == '1.56'
    assert latest['path'] == 'research/2026-11-06/supplier-followup-20261106-r01.html'
    assert latest['dataPath'] == 'research/2026-11-06/supplier-followup-20261106-r01-evidence.json'
    assert latest['previousPath'] == 'research/2026-11-05/supplier-followup-20261105-r17.html'
    assert by_id['gpt-source-followup-r52-20261105']['url'] == '../research/2026-11-05/supplier-followup-20261105-r14.html'
    assert by_id['gpt-source-followup-r52-20261105-evidence']['url'] == '../research/2026-11-05/supplier-followup-20261105-r14-evidence.json'
    r52 = json.loads((ROOT / 'dist/research/2026-11-05/supplier-followup-20261105-r14-evidence.json').read_bytes())
    assert r52['round'] == 52 and r52['site_version'] == '1.9.60' and len(r52['sources']) == 9
    assert r52['new_retail_candidate']['price_usdt_per_month'] == 13.8
    assert r52['new_retail_candidate']['own_existing_chatgpt_account_accepted_verified'] is None
    assert r52['new_retail_candidate']['actual_cny_total_with_invoice'] is None
    assert r52['separate_apple_gift_card']['face_value_usd'] == 20 and r52['separate_apple_gift_card']['merchant_display_price_usd_equivalent'] == 14
    assert r52['separate_apple_gift_card']['apple_resale_authorization_verified'] is False
    assert r52['official_openai_gift_card']['apple_or_google_billed_subscription_not_eligible'] is True
    assert r52['prior_candidate_check']['price_change_confirmed'] is False
    assert r52['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert by_id['gpt-source-followup-r56-20261106']['url'] == '../research/2026-11-06/supplier-followup-20261106-r01.html'
    assert by_id['gpt-source-followup-r56-20261106-evidence']['url'] == '../research/2026-11-06/supplier-followup-20261106-r01-evidence.json'
    r56 = json.loads((ROOT / 'dist/research/2026-11-06/supplier-followup-20261106-r01-evidence.json').read_bytes())
    assert r56['round'] == 56 and r56['site_version'] == '1.9.64' and len(r56['sources']) == 11
    assert r56['v3_inventory_delta']['prior_stock_label'] == '无货'
    assert r56['v3_inventory_delta']['current_stock_label'] == '一般'
    assert r56['v3_inventory_delta']['actual_checkout_availability_tested'] is False
    assert r56['v3_inventory_delta']['real_all_in_cny'] is None
    assert r56['sms_service_new_unverified']['refund_to_original_payment_verified'] is False
    assert r56['sms_service_new_unverified']['chatgpt_web_verified'] is None
    assert r56['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert by_id['gpt-source-followup-r55-20261105']['url'] == '../research/2026-11-05/supplier-followup-20261105-r17.html'
    assert by_id['gpt-source-followup-r55-20261105-evidence']['url'] == '../research/2026-11-05/supplier-followup-20261105-r17-evidence.json'
    r55 = json.loads((ROOT / 'dist/research/2026-11-05/supplier-followup-20261105-r17-evidence.json').read_bytes())
    assert r55['round'] == 55 and r55['site_version'] == '1.9.63' and len(r55['sources']) == 7
    assert r55['candidate']['one_piece_list_price_cny'] == 115 and r55['candidate']['one_month_subscription_term_explicitly_verified'] is None
    assert r55['candidate']['actual_all_in_cny'] is None and r55['candidate']['formal_openai_resale_or_wholesale_authorization_verified'] is False
    assert r55['api']['ordinary_buyer_purchase_api'] is True and r55['api']['independently_verified_old_api_http_410'] is False
    assert r55['api']['order_token_is_not_phone_number_lifetime'] is True
    assert r55['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert by_id['gpt-source-followup-r54-20261105']['url'] == '../research/2026-11-05/supplier-followup-20261105-r16.html'
    assert by_id['gpt-source-followup-r54-20261105-evidence']['url'] == '../research/2026-11-05/supplier-followup-20261105-r16-evidence.json'
    r54 = json.loads((ROOT / 'dist/research/2026-11-05/supplier-followup-20261105-r16-evidence.json').read_bytes())
    assert r54['round'] == 54 and r54['site_version'] == '1.9.62' and len(r54['sources']) == 6
    assert r54['corporate_lead']['price_cny_per_seat_month'] == 165
    assert r54['corporate_lead']['real_paid_all_in_cny'] is None
    assert r54['corporate_lead']['invoice_sample_is_issued_verified'] is False
    assert r54['v3_retail_skus'][0]['reported_inventory'] == '无货'
    assert r54['v3_retail_skus'][0]['stock_change_proven'] is False
    assert r54['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert by_id['gpt-source-followup-r53-20261105']['url'] == '../research/2026-11-05/supplier-followup-20261105-r15.html'
    assert by_id['gpt-source-followup-r53-20261105-evidence']['url'] == '../research/2026-11-05/supplier-followup-20261105-r15-evidence.json'
    r53 = json.loads((ROOT / 'dist/research/2026-11-05/supplier-followup-20261105-r15-evidence.json').read_bytes())
    assert r53['round'] == 53 and r53['site_version'] == '1.9.61' and len(r53['sources']) == 6
    assert [x['merchant_public_wholesale_reference_usdt_per_item'] for x in r53['public_reference_skus']] == [15.5,15.8]
    assert r53['new_wholesale_interface_lead']['final_invoiced_payment_cny'] is None
    assert r53['conflicts']['separate_openapi_redeem_endpoint_requires_cardkey_and_accountsession'] is True
    assert r53['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert by_id['gpt-source-followup-r51-20261105']['url'] == '../research/2026-11-05/supplier-followup-20261105-r13.html'
    assert by_id['gpt-source-followup-r51-20261105-evidence']['url'] == '../research/2026-11-05/supplier-followup-20261105-r13-evidence.json'
    r51 = json.loads((ROOT / 'dist/research/2026-11-05/supplier-followup-20261105-r13-evidence.json').read_bytes())
    assert r51['round'] == 51 and r51['site_version'] == '1.9.59' and len(r51['sources']) == 8
    assert r51['new_retail_supplier']['alipay_wechat_display_cny_per_month'] == 138
    assert r51['new_retail_supplier']['usdt_discounted_display_cny_per_month'] == 133
    assert r51['new_retail_supplier']['real_all_required_fees_including_china_invoice_cny'] is None
    assert r51['new_retail_supplier']['external_redemption_flow_session_or_token_requirements_verified'] is None
    assert r51['reseller_claims_and_terms']['partner_program_is_referral_not_verified_wholesale'] is True
    assert r51['upstream_infrastructure_traces'][1]['public_verified_wholesale_price_cny'] is None
    assert r51['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert by_id['gpt-source-followup-r50-20261105']['url'] == '../research/2026-11-05/supplier-followup-20261105-r12.html'
    assert by_id['gpt-source-followup-r50-20261105-evidence']['url'] == '../research/2026-11-05/supplier-followup-20261105-r12-evidence.json'
    r50 = json.loads((ROOT / 'dist/research/2026-11-05/supplier-followup-20261105-r12-evidence.json').read_bytes())
    assert r50['round'] == 50 and r50['site_version'] == '1.9.58' and len(r50['sources']) == 10
    assert r50['supplier_chain'][0]['forwards_session_to_third_party_claim'] is True
    assert r50['supplier_chain'][0]['full_invoice_included_cny'] is None
    assert r50['supplier_chain'][1]['terms_prohibit_resale_of_purchased_services'] is True
    assert r50['supplier_chain'][2]['public_essential_cost_component_sum_cny'] == 178.08
    assert r50['independent_phone_services'][1]['starts_from_listing_not_purchase_claim'] is True
    assert r50['independent_phone_services'][2]['no_refunds_for_unreceivable_or_invalid_number_claim'] is True
    assert r50['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert by_id['gpt-source-followup-r49-20261105']['url'] == '../research/2026-11-05/supplier-followup-20261105-r11.html'
    assert by_id['gpt-source-followup-r49-20261105-evidence']['url'] == '../research/2026-11-05/supplier-followup-20261105-r11-evidence.json'
    r49 = json.loads((ROOT / 'dist/research/2026-11-05/supplier-followup-20261105-r11-evidence.json').read_bytes())
    assert r49['round'] == 49 and r49['site_version'] == '1.9.57' and len(r49['sources']) == 9
    assert r49['newly_read_direct_merchant']['plus']['display_price'] == 140
    assert r49['newly_read_direct_merchant']['plus']['all_required_fees_with_invoice_cny'] is None
    assert r49['newly_read_direct_merchant']['sms']['alipay_page_claimed_total_cny'] == 18.36
    assert r49['newly_read_direct_merchant']['sms']['usable_for_chatgpt_web_claim'] is False
    assert r49['upstream_trace_secondary']['plus']['display_cny'] == 112
    assert r49['upstream_trace_secondary']['plus']['actual_checkout_price_verified'] is False
    assert r49['upstream_trace_secondary']['codex_sms']['snapshot_date'] == '2026-11-02'
    assert r49['upstream_trace_secondary']['codex_sms']['same_batch_or_wholesale_chain_verified'] is False
    assert r49['separate_other_candidate']['own_account'] is False
    assert r49['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert by_id['gpt-source-followup-r48-20261105']['url'] == '../research/2026-11-05/supplier-followup-20261105-r10.html'
    assert by_id['gpt-source-followup-r48-20261105-evidence']['url'] == '../research/2026-11-05/supplier-followup-20261105-r10-evidence.json'
    r48 = json.loads((ROOT / 'dist/research/2026-11-05/supplier-followup-20261105-r10-evidence.json').read_bytes())
    assert r48['round'] == 48 and r48['site_version'] == '1.9.56' and len(r48['sources']) == 6
    assert r48['new_retail_sku']['display_price'] == 24.99 and r48['new_retail_sku']['currency'] == 'USD'
    assert r48['new_retail_sku']['period_months_verified'] is None
    assert r48['new_upstream_candidate']['costs']['points_per_success'] == 10
    assert r48['new_upstream_candidate']['costs']['all_in_invoice_cny'] is None
    assert r48['new_upstream_candidate']['marketing_demo']['example_wallet_price_is_verified_live_sku'] is False
    assert r48['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert by_id['gpt-source-followup-r47-20261105']['url'] == '../research/2026-11-05/supplier-followup-20261105-r9.html'
    assert by_id['gpt-source-followup-r47-20261105-evidence']['url'] == '../research/2026-11-05/supplier-followup-20261105-r9-evidence.json'
    r47 = json.loads((ROOT / 'dist/research/2026-11-05/supplier-followup-20261105-r9-evidence.json').read_bytes())
    assert r47['round'] == 47 and r47['site_version'] == '1.9.55' and len(r47['sources']) == 9
    assert r47['new_supplier_candidates'][0]['display_price_cny'] == 107
    assert r47['new_supplier_candidates'][0]['all_required_fees_including_china_invoice_cny'] is None
    assert r47['independent_phone_services'][0]['login_password_requested_by_third_party_claim'] is True
    assert r47['independent_phone_services'][0]['failed_sms_refund_to_original_payment_verified'] is None
    assert r47['new_supplier_candidates'][1]['top_agent_discount_usd'] == 0
    assert r47['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert by_id['gpt-source-followup-r46-20261105']['url'] == '../research/2026-11-05/supplier-followup-20261105-r8.html'
    assert by_id['gpt-source-followup-r46-20261105-evidence']['url'] == '../research/2026-11-05/supplier-followup-20261105-r8-evidence.json'
    r46 = json.loads((ROOT / 'dist/research/2026-11-05/supplier-followup-20261105-r8-evidence.json').read_bytes())
    assert r46['round'] == 46 and r46['site_version'] == '1.9.54'
    assert r46['material_observation']['account_skus'][0]['historical_display_price_cny'] == 115
    assert r46['material_observation']['account_skus'][0]['current_display_price_cny'] == 113
    assert r46['material_observation']['account_skus'][0]['period_months_verified_on_current_page'] is None
    assert r46['material_observation']['account_skus'][1]['historical_display_price_cny'] == 130
    assert r46['material_observation']['account_skus'][1]['current_display_price_cny'] == 129
    assert r46['material_observation']['account_skus'][1]['all_required_fees_including_china_invoice_cny'] is None
    assert r46['additional_bounded_sources']['new_retail_candidate_checkout_test_mode']['real_money_checkout_confirmed'] is False
    assert r46['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert by_id['gpt-source-followup-r45-20261105']['url'] == '../research/2026-11-05/supplier-followup-20261105-r7.html'
    assert by_id['gpt-source-followup-r45-20261105-evidence']['url'] == '../research/2026-11-05/supplier-followup-20261105-r7-evidence.json'
    r45 = json.loads((ROOT / 'dist/research/2026-11-05/supplier-followup-20261105-r7-evidence.json').read_bytes())
    assert r45['round'] == 45 and r45['site_version'] == '1.9.53'
    assert r45['new_candidate']['display_price_cny'] == 139
    assert r45['new_candidate']['invoice_fee_rate_claim'] == 0.03
    assert r45['new_candidate']['public_known_components_sum_cny'] == 143.17
    assert r45['new_candidate']['payment_fee_cny'] is None
    assert r45['new_candidate']['real_paid_all_fees_including_invoice_cny'] is None
    assert len([source for source in r45['sources'] if source['read_status'] == 'success_read']) == 7
    assert r45['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert by_id['gpt-source-followup-r44-20261105']['url'] == '../research/2026-11-05/supplier-followup-20261105-r6.html'
    assert by_id['gpt-source-followup-r44-20261105-evidence']['url'] == '../research/2026-11-05/supplier-followup-20261105-r6-evidence.json'
    r44 = json.loads((ROOT / 'dist/research/2026-11-05/supplier-followup-20261105-r6-evidence.json').read_bytes())
    assert r44['round'] == 44 and r44['site_version'] == '1.9.52' and len(r44['sources']) == 7
    assert r44['new_candidate']['display_price_cny'] == 128.8
    assert r44['new_candidate']['real_paid_invoice_included_cny'] is None
    assert r44['new_candidate']['china_vat_invoice_available_at_displayed_sku'] is False
    assert r44['bounded_recheck']['individual_order_china_tax_invoice_supported_claim'] is False
    assert r44['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert by_id['gpt-source-followup-r43-20261105']['url'] == '../research/2026-11-05/supplier-followup-20261105-r5.html'
    assert by_id['gpt-source-followup-r43-20261105-evidence']['url'] == '../research/2026-11-05/supplier-followup-20261105-r5-evidence.json'
    r43 = json.loads((ROOT / 'dist/research/2026-11-05/supplier-followup-20261105-r5-evidence.json').read_bytes())
    assert r43['round'] == 43 and r43['site_version'] == '1.9.51' and len(r43['sources']) == 11
    assert r43['current_plus']['display_price_cny'] == 155 and r43['current_plus']['real_paid_invoice_included_cny'] is None
    assert r43['independent_phone_service']['display_price_cny_per_one_time'] == 12
    assert r43['qualification_totals']['new_verified_plus_wholesale_upstreams'] == 0
    assert by_id['gpt-source-followup-r42-20261105']['url'] == '../research/2026-11-05/supplier-followup-20261105-r4.html'
    assert by_id['gpt-source-followup-r42-20261105-evidence']['url'] == '../research/2026-11-05/supplier-followup-20261105-r4-evidence.json'
    r42 = json.loads((ROOT / 'dist/research/2026-11-05/supplier-followup-20261105-r4-evidence.json').read_bytes())
    assert r42['round'] == 42 and r42['site_version'] == '1.9.50' and len(r42['sources']) == 8
    assert r42['new_candidates'][0]['public_component_sum_cny'] == 155.4
    assert r42['new_candidates'][0]['real_paid_invoice_included_cny'] is None
    assert r42['new_candidates'][0]['session_shared_with_partner_fulfillment_claim'] is True
    assert r42['independent_phone_services'][0]['post_payment_refund_supported_claim'] is False
    assert r42['independent_phone_services'][0]['number_session_window_minutes_claim'] == 20
    assert r42['qualification_totals']['new_verified_plus_wholesale_upstreams'] == 0
    assert by_id['gpt-source-followup-r41-20261105']['url'] == '../research/2026-11-05/supplier-followup-20261105-r3.html'
    assert by_id['gpt-source-followup-r41-20261105-evidence']['url'] == '../research/2026-11-05/supplier-followup-20261105-r3-evidence.json'
    r41 = json.loads((ROOT / 'dist/research/2026-11-05/supplier-followup-20261105-r3-evidence.json').read_bytes())
    assert r41['round'] == 41 and r41['site_version'] == '1.9.49'
    assert len(r41['sources']) == 6 and len(r41['new_candidates']) == 5
    assert r41['new_candidates'][2]['display_price_cny'] == 168
    assert r41['new_candidates'][2]['real_paid_invoice_included_cny'] is None
    assert r41['new_candidates'][4]['unauthorized_resale_prohibited_by_terms'] is True
    assert r41['qualification_totals']['new_verified_plus_wholesale_upstreams'] == 0
    assert by_id['gpt-source-followup-r40-20261105']['url'] == '../research/2026-11-05/supplier-followup-20261105-r2.html'
    assert by_id['gpt-source-followup-r40-20261105-evidence']['url'] == '../research/2026-11-05/supplier-followup-20261105-r2-evidence.json'
    r40 = json.loads((ROOT / 'dist/research/2026-11-05/supplier-followup-20261105-r2-evidence.json').read_bytes())
    assert r40['round'] == 40 and r40['site_version'] == '1.9.48'
    assert r40['independent_phone_services'][0]['scanned_payment_refund_to_original_payment_method_claim'] is False
    assert r40['independent_phone_services'][2]['real_payable_sku_confirmed'] is False
    assert r40['independent_phone_services'][2]['number_held_for_30_or_60_days'] is False
    assert r40['qualification_totals']['new_verified_plus_wholesale_upstreams'] == 0
    assert by_id['gpt-source-followup-r39-20261105']['url'] == '../research/2026-11-05/supplier-followup-20261105.html'
    assert by_id['gpt-source-followup-r39-20261105-evidence']['url'] == '../research/2026-11-05/supplier-followup-20261105-evidence.json'
    r39 = json.loads((ROOT / 'dist/research/2026-11-05/supplier-followup-20261105-evidence.json').read_bytes())
    assert r39['round'] == 39 and r39['site_version'] == '1.9.47'
    assert r39['new_candidates'][0]['public_component_sum_cny'] == 153
    assert r39['new_candidates'][0]['real_paid_invoice_included_cny'] is None
    assert r39['official_phone_verification']['first_api_key_phone_verification_required'] is True
    assert r39['official_phone_verification']['voip_supported'] is False
    assert r39['qualification_totals']['new_verified_plus_wholesale_upstreams'] == 0
    assert by_id['gpt-source-followup-r38-20261104']['url'] == '../research/2026-11-04/supplier-followup-20261104-r24.html'
    assert by_id['gpt-source-followup-r38-20261104-evidence']['url'] == '../research/2026-11-04/supplier-followup-20261104-r24-evidence.json'
    r38 = json.loads((ROOT / 'dist/research/2026-11-04/supplier-followup-20261104-r24-evidence.json').read_bytes())
    assert r38['round'] == 38 and len(r38['sources']) == 4
    assert r38['changes'][0]['offer_end_local'] == '2026-11-11T23:59:00+08:00'
    assert r38['changes'][0]['coupon_and_first_purchase_task_stack'] is False
    assert r38['changes'][0]['real_all_required_fees_invoice_included_cny'] is None
    assert '更换全新官方账号' in r38['changes'][1]['seller_remedy_options']
    assert r38['changes'][1]['real_all_required_fees_invoice_included_cny'] is None
    assert r38['qualification_totals']['new_verified_plus_wholesale_upstreams'] == 0
    assert r38['phone_verification']['tests_done'] == 0
    assert by_id['gpt-source-followup-r37-20261104']['url'] == '../research/2026-11-04/supplier-followup-20261104-r23.html'
    assert by_id['gpt-source-followup-r37-20261104-evidence']['url'] == '../research/2026-11-04/supplier-followup-20261104-r23-evidence.json'
    r37 = json.loads((ROOT / 'dist/research/2026-11-04/supplier-followup-20261104-r23-evidence.json').read_bytes())
    assert r37['round'] == 37 and len(r37['sources']) == 7
    assert r37['new_candidates'][0]['display_cny_per_seat_per_month'] == 165
    assert r37['new_candidates'][0]['real_paid_invoice_included_cny'] is None
    assert r37['new_candidates'][1]['payment_subtotal_preview_cny'] == 149.78
    assert r37['new_candidates'][1]['real_paid_invoice_included_cny'] is None
    assert r37['qualification_totals']['new_verified_plus_wholesale_upstreams'] == 0
    assert r37['phone_verification']['real_tests'] == 0
    assert by_id['gpt-source-followup-r36-20261104']['url'] == '../research/2026-11-04/supplier-followup-20261104-r22.html'
    assert by_id['gpt-source-followup-r36-20261104-evidence']['url'] == '../research/2026-11-04/supplier-followup-20261104-r22-evidence.json'
    r36 = json.loads((ROOT / 'dist/research/2026-11-04/supplier-followup-20261104-r22-evidence.json').read_bytes())
    assert r36['round'] == 36 and len(r36['sources']) == 6
    assert r36['new_invoice_evidence']['site_explicit_no_china_vat_invoice'] is True
    assert r36['new_invoice_evidence']['total_plus_invoice_included_cny'] is None
    assert r36['qualification_totals']['new_verified_plus_wholesale_upstreams'] == 0
    assert by_id['gpt-source-followup-r34-20261104']['url'] == '../research/2026-11-04/supplier-followup-20261104-r20.html'
    assert by_id['gpt-source-followup-r34-20261104-evidence']['url'] == '../research/2026-11-04/supplier-followup-20261104-r20-evidence.json'
    r34 = json.loads((ROOT / 'dist/research/2026-11-04/supplier-followup-20261104-r20-evidence.json').read_bytes())
    assert r34['round'] == 34 and len(r34['sources']) == 6
    i34 = r34['invoice_progress']
    assert i34['plus_display_price_cny_per_unit_month'] == 118 and i34['price_change_proven'] is False
    assert i34['chinese_vat_electronic_general_invoice_merchant_claim'] is True
    assert i34['chinese_vat_electronic_special_invoice_merchant_claim'] is True
    assert i34['invoice_general_tax_point_rate'] is None and i34['invoice_special_tax_point_rate'] is None
    assert i34['actual_stripe_invoice_all_in_cny'] is None and i34['actual_wechat_invoice_all_in_cny'] is None
    assert i34['invoice_issuer_name'] is None and i34['tax_invoice_verified'] is False
    assert r34['qualification_totals']['new_verified_plus_wholesale_upstreams'] == 0
    assert r34['independent_phone_verification']['successful_tests'] == 0
    # r33: old supplier, genuinely new supply-recruitment evidence; no fabricated new wholesaler or price.
    assert by_id['gpt-source-followup-r33-20261104']['url'] == '../research/2026-11-04/supplier-followup-20261104-r19.html'
    assert by_id['gpt-source-followup-r33-20261104-evidence']['url'] == '../research/2026-11-04/supplier-followup-20261104-r19-evidence.json'
    r33 = json.loads((ROOT / 'dist/research/2026-11-04/supplier-followup-20261104-r19-evidence.json').read_bytes())
    assert r33['round'] == 33 and len(r33['sources']) == 5
    chain = r33['chain_identification']
    assert chain['new_primary_source_url'] == 'https://www.chatgqt.plus/supply'
    assert chain['verified_supplier_identity'] is None and chain['openai_resale_authorization_verified'] is False
    assert r33['qualification_totals']['new_independent_suppliers_added'] == 0
    assert r33['qualification_totals']['new_verified_plus_wholesale_upstreams'] == 0
    assert r33['existing_agent_terms_not_newly_changed']['required_agent_entry_fee_cny'] == 3000
    assert r33['existing_plus_skus_not_newly_repriced'][0]['all_in_cny'] is None
    assert r33['new_distinction']['claimed_not_api'] is True
    assert r33['independent_phone_verification']['successful_verification_tests'] == 0
    # r32: public retail invoice components must not imply actual VAT invoice, guest eligibility or verified SMS success.
    assert by_id['gpt-source-followup-r32-20261104']['url'] == '../research/2026-11-04/supplier-followup-20261104-r18.html'
    assert by_id['gpt-source-followup-r32-20261104-evidence']['url'] == '../research/2026-11-04/supplier-followup-20261104-r18-evidence.json'
    r32 = json.loads((ROOT / 'dist/research/2026-11-04/supplier-followup-20261104-r18-evidence.json').read_bytes())
    assert r32['round'] == 32 and len(r32['sources']) == 7
    assert r32['candidates'][0]['public_plus_price_cny_per_month'] == 139.99
    assert r32['candidates'][0]['merchant_public_e_invoice_addon_cny_per_unit'] == 10
    assert r32['candidates'][0]['public_component_sum_cny'] == 149.99
    assert r32['candidates'][0]['all_in_cny'] is None and r32['candidates'][0]['guest_invoice_eligible_verified'] is None
    assert r32['candidates'][0]['qualified_wholesale'] is False and r32['candidates'][0]['actual_purchased'] is False
    assert r32['independent_phone_verification']['claimed_60_day_price_cny'] == 20
    assert r32['independent_phone_verification']['tested_success_count'] == 0
    # r31: mainland exclusion/enterprise MOQ and crypto quote must not be misclassified as invoiced wholesale.
    assert by_id['gpt-source-followup-r31-20261104']['url'] == '../research/2026-11-04/supplier-followup-20261104-r17.html'
    assert by_id['gpt-source-followup-r31-20261104-evidence']['url'] == '../research/2026-11-04/supplier-followup-20261104-r17-evidence.json'
    r31 = json.loads((ROOT / 'dist/research/2026-11-04/supplier-followup-20261104-r17-evidence.json').read_bytes())
    assert r31['round'] == 31 and r31['direct_read_source_count'] == len(r31['sources']) == 7
    assert len(r31['candidates']) == 3 and r31['candidates'][0]['strictly_excludes_users_physically_in_mainland_china'] is True
    assert r31['candidates'][0]['enterprise_min_units_claimed'] == 5 and r31['candidates'][0]['live_checkout_base_usd'] is None
    assert r31['candidates'][0]['all_in_cny'] is None and r31['candidates'][0]['claimed_chinese_vat_invoice_addon_usd'] == 2.10
    assert r31['candidates'][1]['display_price_usdt'] == 13.8 and r31['candidates'][1]['all_in_cny'] is None
    assert r31['candidates'][2]['session_token_mandatory_claimed'] is True and r31['candidates'][2]['store_product_body_accessible'] is False
    assert all(x['qualified_wholesale'] is False for x in r31['candidates'])
    assert r31['verified_plus_wholesale_count'] == r31['real_invoice_verified_count'] == r31['actual_purchase_count'] == r31['phone_verification_success_count'] == 0
    assert r31['historical_126_quote_records_preserved'] and r31['old_price_overwritten'] is False
    # r30: preliminary price and company invoice precheck cannot prove an invoice-inclusive wholesale cost.
    assert by_id['gpt-source-followup-r30-20261104']['url'] == '../research/2026-11-04/supplier-followup-20261104-r16.html'
    assert by_id['gpt-source-followup-r30-20261104-evidence']['url'] == '../research/2026-11-04/supplier-followup-20261104-r16-evidence.json'
    r30 = json.loads((ROOT / 'dist/research/2026-11-04/supplier-followup-20261104-r16-evidence.json').read_bytes())
    assert r30['round'] == 30 and r30['direct_read_source_count'] == len(r30['sources']) == 6
    assert len(r30['candidates']) == 1
    item = r30['candidates'][0]
    assert item['sku_product_id'] == '7' and item['display_price_cny'] == 160
    assert item['all_in_tax_invoice_checkout_cny'] is None and item['invoice_fee_cny'] is None
    assert item['actual_purchase_verified'] is False and item['invoice_verified'] is False
    assert item['qualified_wholesale'] is False and item['wholesale_unit_price_cny'] is None
    assert item['prior_chatgpt_web_login_required'] is True and item['session_or_token_may_be_required_claimed'] is True
    assert r30['independent_phone_verification']['new_standalone_openai_sms_sku_found'] is False
    assert r30['verified_plus_wholesale_count'] == r30['actual_purchase_count'] == r30['real_invoice_verified_count'] == r30['phone_verification_success_count'] == 0
    assert r30['historical_126_quote_records_preserved'] and r30['old_price_overwritten'] is False
    # r29 newly read merchant disclosures are not proof of successful wholesale transactions.
    assert by_id['gpt-source-followup-r29-20261104']['url'] == '../research/2026-11-04/supplier-followup-20261104-r15.html'
    assert by_id['gpt-source-followup-r29-20261104-evidence']['url'] == '../research/2026-11-04/supplier-followup-20261104-r15-evidence.json'
    r29 = json.loads((ROOT / 'dist/research/2026-11-04/supplier-followup-20261104-r15-evidence.json').read_bytes())
    assert r29['round'] == 29 and r29['direct_read_source_count'] == len(r29['sources']) == 6
    assert r29['candidates'][0]['mainland_physically_present_customers_accepted_claimed'] is False
    assert r29['candidates'][0]['actual_invoice_inclusive_checkout_cny'] is None
    assert r29['candidates'][1]['display_price_cny'] == 168
    assert r29['candidates'][1]['session_requirement_claimed'] is True
    assert r29['candidates'][1]['all_in_tax_invoice_checkout_cny'] is None
    assert all(not x['qualified_wholesale'] and not x['actual_purchase_verified'] for x in r29['candidates'])
    assert r29['verified_plus_wholesale_count'] == r29['actual_purchase_count'] == r29['real_invoice_verified_count'] == r29['phone_verification_success_count'] == 0
    assert r29['historical_126_quote_records_preserved'] and not r29['old_price_overwritten']
    # r28: same-URL display-price difference does not prove real paid USDT or VAT.
    assert by_id['gpt-source-followup-r28-20261104']['url'] == '../research/2026-11-04/supplier-followup-20261104-r14.html'
    assert by_id['gpt-source-followup-r28-20261104-evidence']['url'] == '../research/2026-11-04/supplier-followup-20261104-r14-evidence.json'
    r28 = json.loads((ROOT / 'dist/research/2026-11-04/supplier-followup-20261104-r14-evidence.json').read_bytes())
    assert r28['round'] == 28 and r28['direct_read_source_count'] == len(r28['sources']) == 8
    assert r28['historical_comparison']['prior_display_cny'] == 112 and r28['historical_comparison']['new_display_cny'] == 110
    assert r28['historical_comparison']['same_original_url'] == r28['candidates'][0]['sku_url']
    assert r28['candidates'][0]['all_in_cny'] is None and r28['candidates'][0]['subscription_period_months_reconfirmed'] is None
    assert r28['candidates'][1]['display_usd'] == 21 and r28['candidates'][1]['domestic_tax_invoice_available_claimed'] is False
    assert r28['candidates'][1]['all_in_cny'] is None
    assert all(not c['qualified_wholesale'] and not c['invoice_verified'] for c in r28['candidates'])
    assert r28['verified_plus_wholesale_count'] == r28['actual_purchase_count'] == r28['real_invoice_verified_count'] == r28['phone_verification_success_count'] == 0
    assert r28['historical_126_quote_records_preserved'] is True and r28['old_price_overwritten'] is False
    # r27 preserves separate tax-invoice and overseas receipt SKU eligibility.
    assert by_id['gpt-source-followup-r27-20261104']['url'] == '../research/2026-11-04/supplier-followup-20261104-r13.html'
    assert by_id['gpt-source-followup-r27-20261104-evidence']['url'] == '../research/2026-11-04/supplier-followup-20261104-r13-evidence.json'
    r27 = json.loads((ROOT / 'dist/research/2026-11-04/supplier-followup-20261104-r13-evidence.json').read_bytes())
    assert r27['round'] == 27 and r27['direct_read_source_count'] == len(r27['sources']) == 9
    assert r27['candidates'][0]['listed_price_cny'] == 128.8 and r27['candidates'][0]['chinese_vat_invoice_available_on_this_sku'] is False
    assert r27['candidates'][0]['all_in_chinese_invoice_total_cny'] is None and r27['candidates'][0]['payment_channel_fee_cny'] is None
    assert r27['candidates'][1]['listed_price_cny'] == 165 and r27['candidates'][1]['merchant_stated_invoice_inclusive_price_cny'] == 183
    assert r27['candidates'][1]['invoice_article_inconsistent_arithmetic'] is True and r27['candidates'][1]['actual_all_in_paid_cny'] is None
    assert all(x['qualified_wholesale'] is False and x['real_invoice_verified'] is False for x in r27['candidates'])
    assert r27['verified_plus_wholesale_count'] == r27['actual_purchase_count'] == r27['real_invoice_verified_count'] == r27['phone_verification_success_count'] == 0
    assert r27['historical_126_quote_records_preserved'] is True and r27['old_prices_refreshed'] == 0
    # r26 separates a real merchant retail SKU from an unconfirmed DOM modal.
    assert by_id['gpt-source-followup-r26-20261104']['url'] == '../research/2026-11-04/supplier-followup-20261104-r12.html'
    assert by_id['gpt-source-followup-r26-20261104-evidence']['url'] == '../research/2026-11-04/supplier-followup-20261104-r12-evidence.json'
    r26 = json.loads((ROOT / 'dist/research/2026-11-04/supplier-followup-20261104-r12-evidence.json').read_bytes())
    assert r26['round'] == 26 and len(r26['sources']) == 6
    assert r26['candidates'][0]['display_price_cny'] == 149 and r26['candidates'][0]['merchant_terms_invoice_promised'] is False
    assert r26['candidates'][0]['all_in_invoice_total_cny'] is None
    assert r26['candidates'][1]['embedded_modal_total_cny'] == 149.78 and r26['candidates'][1]['real_sku_selected'] is False
    assert r26['candidates'][1]['actual_checkout_fee_cny'] is None and r26['candidates'][1]['affiliate_self_purchase_qualifies'] is False
    assert all(x['authorized_resale_verified'] is False and x['verified_qualified'] is False for x in r26['candidates'])
    assert r26['verified_plus_wholesale_count'] == r26['actual_purchase_count'] == r26['real_invoice_verified_count'] == r26['phone_verification_success_count'] == 0
    assert r26['historical_126_quote_records_preserved'] is True and r26['old_prices_refreshed'] == 0
    # r25 is a new observation; keep r24 and all earlier frozen evidence below.
    assert by_id['gpt-source-followup-r25-20261104']['url'] == '../research/2026-11-04/supplier-followup-20261104-r11.html'
    assert by_id['gpt-source-followup-r25-20261104-evidence']['url'] == '../research/2026-11-04/supplier-followup-20261104-r11-evidence.json'
    r25 = json.loads((ROOT / 'dist/research/2026-11-04/supplier-followup-20261104-r11-evidence.json').read_bytes())
    assert r25['round'] == 25 and len(r25['sources']) == 5
    assert r25['offer']['sku_parameter'] == 27 and r25['offer']['observed_display_price_cny'] == 139.99
    assert r25['offer']['member_login_required_for_e_invoice_claimed'] is True
    assert r25['offer']['logged_in_at_order_time_required_for_invoice_claimed'] is True
    assert r25['offer']['invoice_fee_cny'] is None and r25['offer']['final_paid_total_with_invoice_cny'] is None
    assert r25['offer']['actual_tax_invoice_verified'] is False and r25['offer']['warranty_excludes_platform_phone_verification_fee_claimed'] is True
    assert r25['independent_phone_verification']['sms_price_cny'] is None
    assert r25['verified_plus_wholesale_count'] == r25['actual_purchase_count'] == r25['real_invoice_verified_count'] == r25['phone_verification_success_count'] == 0
    assert r25['historical_126_quote_records_preserved'] is True and r25['old_prices_refreshed'] == 0
    # r24 contains two distinct enterprise-invoice SKUs, not the homepage family starting price.
    assert by_id['gpt-source-followup-r24-20261104']['url'] == '../research/2026-11-04/supplier-followup-20261104-r10.html'
    assert by_id['gpt-source-followup-r24-20261104-evidence']['url'] == '../research/2026-11-04/supplier-followup-20261104-r10-evidence.json'
    r24 = json.loads((ROOT / 'dist/research/2026-11-04/supplier-followup-20261104-r10-evidence.json').read_bytes())
    assert r24['round'] == 24 and len(r24['sources']) == 7
    assert [x['price_per_unit_cny'] for x in r24['candidates']] == [179, 189]
    assert [x['known_base_price_exceeds_cap_cny'] for x in r24['candidates']] == [9, 19]
    assert all(x['period_months'] == 1 and x['min_quantity'] == 1 for x in r24['candidates'])
    assert all(x['final_paid_total_with_invoice_cny'] is None and x['payment_fee_cny'] is None for x in r24['candidates'])
    assert r24['pricing_differentiation']['homepage_starting_price_is_enterprise_invoicable_sku'] is False
    assert r24['independent_phone_verification']['specific_openai_number_price_cny'] is None
    assert r24['independent_phone_verification']['number_duration_minutes'] is None
    assert r24['independent_phone_verification']['chatgpt_web_applicability'] is None
    assert r24['verified_plus_wholesale_count'] == r24['real_invoice_verified_count'] == r24['phone_verification_success_count'] == 0
    assert r24['historical_126_quote_records_preserved'] is True and r24['old_prices_refreshed'] == 0
    # r23 remains immutable and independently tested below.

    assert by_id['gpt-source-followup-r23-20261104']['url'] == '../research/2026-11-04/supplier-followup-20261104-r9.html'
    assert by_id['gpt-source-followup-r23-20261104-evidence']['url'] == '../research/2026-11-04/supplier-followup-20261104-r9-evidence.json'
    r23 = json.loads((ROOT / 'dist/research/2026-11-04/supplier-followup-20261104-r9-evidence.json').read_bytes())
    assert r23['round'] == 23 and len(r23['sources']) == 9
    assert r23['candidates'][0]['base_listed_price_cny'] == 125
    assert r23['candidates'][0]['period_days'] is None
    assert r23['candidates'][0]['invoice_fee_cny'] is None and r23['candidates'][0]['final_paid_total_with_invoice_cny'] is None
    assert r23['candidates'][0]['post_delivery_warranty_for_normal_topup'] is False
    assert r23['candidates'][0]['entity_registration_independently_verified'] is False
    assert r23['verified_plus_wholesale_count'] == r23['real_invoice_verified_count'] == r23['phone_verification_success_count'] == 0
    assert r23['historical_126_quote_records_preserved'] is True and r23['old_prices_refreshed'] == 0
    assert by_id['gpt-source-followup-r22-20261104']['url'] == '../research/2026-11-04/supplier-followup-20261104-r8.html'
    assert by_id['gpt-source-followup-r22-20261104-evidence']['url'] == '../research/2026-11-04/supplier-followup-20261104-r8-evidence.json'
    r22 = json.loads((ROOT / 'dist/research/2026-11-04/supplier-followup-20261104-r8-evidence.json').read_bytes())
    assert r22['round'] == 22 and len(r22['sources']) == 6
    assert r22['candidates'][0]['known_price_plus_invoice_components_cny'] == 215
    assert r22['candidates'][1]['period_days'] is None
    assert r22['candidates'][1]['final_paid_total_with_invoice_cny'] is None
    assert r22['verified_plus_wholesale_count'] == r22['real_invoice_verified_count'] == r22['phone_verification_success_count'] == 0
    assert r22['historical_126_quote_records_preserved'] is True and r22['old_prices_refreshed'] == 0
    assert by_id['gpt-source-followup-r21-20261104']['url'] == '../research/2026-11-04/supplier-followup-20261104-r7.html'
    assert by_id['gpt-source-followup-r21-20261104-evidence']['url'] == '../research/2026-11-04/supplier-followup-20261104-r7-evidence.json'
    r21 = json.loads((ROOT / 'dist/research/2026-11-04/supplier-followup-20261104-r7-evidence.json').read_bytes())
    assert r21['round'] == 21 and len(r21['sources']) == 7
    assert r21['phone_verification']['api_initial_key_verification_same_number_max_accounts'] == 3
    assert r21['phone_verification']['linked_phone_number_change_supported'] is False
    assert r21['phone_verification']['phone_only_signup_separate_from_api_verification'] is True
    assert r21['giffgaff_followup']['china_specific_outbound_sms_fee_gbp'] is None
    assert r21['verified_plus_wholesale_count'] == r21['real_invoice_verified_count'] == r21['phone_verification_success_count'] == 0
    assert r21['historical_126_quote_records_preserved'] is True and r21['old_prices_refreshed'] == 0
    # r20 remains a reviewed historical artifact.
    assert by_id['gpt-source-followup-r20-20261104']['url'] == '../research/2026-11-04/supplier-followup-20261104-r6.html'
    assert by_id['gpt-source-followup-r20-20261104-evidence']['url'] == '../research/2026-11-04/supplier-followup-20261104-r6-evidence.json'
    r20 = json.loads((ROOT / 'dist/research/2026-11-04/supplier-followup-20261104-r6-evidence.json').read_bytes())
    assert r20['round'] == 20 and len(r20['sources']) == 5
    assert r20['phone_verification']['first_activation_payment_required'] is True
    assert r20['phone_verification']['first_activation_minimum_gbp'] is None
    assert r20['phone_verification']['official_direct_shipping_to_china'] is False
    assert r20['phone_verification']['inactivity_deactivation_months'] == 6
    assert r20['phone_verification']['uk_whatsapp_otp_listed'] is False
    assert r20['phone_verification_success_count'] == r20['verified_plus_wholesale_count'] == r20['actual_purchase_count'] == 0
    assert r20['historical_126_quote_records_preserved'] is True and r20['old_prices_refreshed'] == 0
    # r19 remains a reviewed historical fixed artifact, tested below.
    assert by_id['gpt-source-followup-r19-20261104']['url'] == '../research/2026-11-04/supplier-followup-20261104-r5.html'
    assert by_id['gpt-source-followup-r19-20261104-evidence']['url'] == '../research/2026-11-04/supplier-followup-20261104-r5-evidence.json'
    r19 = json.loads((ROOT / 'dist/research/2026-11-04/supplier-followup-20261104-r5-evidence.json').read_bytes())
    assert r19['round'] == 19 and len(r19['sources']) == 12
    assert r19['offers'][0]['price_cny'] == 125 and r19['offers'][1]['price_cny'] == 135
    assert r19['offers'][0]['wholesale_entry_fee_cny'] == 3000 and r19['offers'][0]['wholesale_price_cny'] is None
    assert r19['offers'][2]['price_cny'] == 145 and r19['offers'][2]['actual_paid_cny'] is None
    assert r19['offers'][2]['invoice_fee_cny'] is None and r19['offers'][2]['final_tax_invoice_all_in_cny'] is None
    assert r19['verified_plus_wholesale_count'] == r19['actual_purchase_count'] == r19['real_invoice_verified_count'] == r19['phone_verification_success_count'] == 0
    assert r19['historical_126_quote_records_preserved'] is True and r19['old_prices_refreshed'] == 0
    # r18 remains a reviewed historical fixed artifact.
    assert latest['version'] != '1.18'
    assert by_id['gpt-source-followup-r18-20261104']['url'] == '../research/2026-11-04/supplier-followup-20261104-r4.html'
    assert by_id['gpt-source-followup-r18-20261104-evidence']['url'] == '../research/2026-11-04/supplier-followup-20261104-r4-evidence.json'
    r18 = json.loads((ROOT / 'dist/research/2026-11-04/supplier-followup-20261104-r4-evidence.json').read_bytes())
    assert r18['round'] == 18 and len(r18['sources']) == 7
    assert r18['verified_plus_wholesale_count'] == r18['actual_purchase_count'] == r18['phone_verification_success_count'] == r18['real_invoice_verified_count'] == 0
    assert r18['offers'][0]['retail_price_cny'] == 129 and r18['offers'][0]['wholesale_display_price_cny'] == 112
    assert r18['offers'][0]['wholesale_minimum_prepaid_balance_cny'] == 500
    assert r18['offers'][0]['meets_no_upfront_deposit_rule'] is False
    assert r18['offers'][0]['invoice_fee_cny'] is None and r18['offers'][0]['final_tax_invoice_all_in_cny'] is None
    assert r18['other_business_models'][0]['first_conversion_commission_cny'] == 20
    assert r18['historical_126_quote_records_preserved'] is True and r18['old_prices_refreshed'] == 0
    assert by_id['gpt-source-followup-r17-20261104']['url'] == '../research/2026-11-04/supplier-followup-20261104-r3.html'
    assert by_id['gpt-source-followup-r17-20261104-evidence']['url'] == '../research/2026-11-04/supplier-followup-20261104-r3-evidence.json'
    r17 = json.loads((ROOT / 'dist/research/2026-11-04/supplier-followup-20261104-r3-evidence.json').read_bytes())
    assert len(r17['sources']) == 10 and r17['verified_plus_wholesale_count'] == r17['actual_purchase_count'] == r17['phone_verification_success_count'] == 0
    assert r17['offers'][0]['known_component_sum_cny'] == 153 and r17['offers'][0]['final_tax_invoice_all_in_cny'] is None
    assert r17['offers'][1]['price_cny'] == 107 and r17['offers'][1]['invoice_fee_cny'] is None
    assert r17['phone_verification']['price_cny'] == 3 and r17['phone_verification']['number_holding_days'] is None
    assert r17['phone_verification']['actual_verified_success'] is False
    assert by_id['gpt-source-followup-r16-20261104']['url'] == '../research/2026-11-04/supplier-followup-20261104-r2.html'
    assert by_id['gpt-source-followup-r16-evidence-20261104']['url'] == '../research/2026-11-04/supplier-followup-20261104-r2-evidence.json'
    r16 = json.loads((ROOT / 'dist/research/2026-11-04/supplier-followup-20261104-r2-evidence.json').read_bytes())
    assert len(r16['sources']) == 8 and r16['verified_plus_wholesale_count'] == r16['actual_purchase_count'] == r16['phone_verification_success_count'] == 0
    assert r16['offer']['homepage_display_price_cny'] == 148.8
    assert r16['offer']['tax_invoice_all_in_cny'] is None and r16['offer']['actual_single_unit_checkout_price_cny'] is None
    assert r16['offer']['already_plus_active_renewal_supported'] is False and r16['wholesale']['upstream_authorization_verified'] is False
    # Prior r15 report is preserved and checked below.
    assert by_id['gpt-source-followup-r15-20261104']['url'] == '../research/2026-11-04/supplier-followup-20261104.html'
    assert by_id['gpt-source-followup-r15-evidence-20261104']['url'] == '../research/2026-11-04/supplier-followup-20261104-evidence.json'
    r15 = json.loads((ROOT / 'dist/research/2026-11-04/supplier-followup-20261104-evidence.json').read_bytes())
    assert len(r15['sources']) == 6 and r15['verified_plus_wholesale_count'] == r15['actual_purchase_count'] == r15['phone_verification_success_count'] == 0
    assert r15['sms_service']['batch_expiry_date'] is None
    assert r15['virtual_card_payment_route'][0]['topup_percent'] != r15['virtual_card_payment_route'][1]['topup_percent']
    assert by_id['gpt-source-followup-r14-20261103']['url'] == '../research/2026-11-03/supplier-followup-20261103-r14.html'
    assert by_id['gpt-source-followup-r14-evidence-20261103']['url'] == '../research/2026-11-03/supplier-followup-20261103-r14-evidence.json'
    assert by_id['gpt-source-followup-r13-20261103']['url'] == '../research/2026-11-03/supplier-followup-20261103-r13.html'
    assert by_id['gpt-source-followup-r13-evidence-20261103']['url'] == '../research/2026-11-03/supplier-followup-20261103-r13-evidence.json'
    assert by_id['gpt-source-followup-r12-20261103']['url'] == '../research/2026-11-03/supplier-followup-20261103-r12.html'
    assert by_id['gpt-source-followup-r12-evidence-20261103']['url'] == '../research/2026-11-03/supplier-followup-20261103-r12-evidence.json'
    assert by_id['gpt-source-followup-r11-20261103']['url'] == '../research/2026-11-03/supplier-followup-20261103-r11.html'
    assert by_id['gpt-source-followup-r11-evidence-20261103']['url'] == '../research/2026-11-03/supplier-followup-20261103-r11-evidence.json'
    assert by_id['gpt-source-followup-r10-20261103']['url'] == '../research/2026-11-03/supplier-followup-20261103-r10.html'
    assert by_id['gpt-source-followup-r10-evidence-20261103']['url'] == '../research/2026-11-03/supplier-followup-20261103-r10-evidence.json'
    assert by_id['gpt-source-followup-r9-20261103']['url'] == '../research/2026-11-03/supplier-followup-20261103-r9.html'
    assert by_id['gpt-source-followup-r9-evidence-20261103']['url'] == '../research/2026-11-03/supplier-followup-20261103-r9-evidence.json'
    assert by_id['gpt-source-followup-r8-20261103']['url'] == '../research/2026-11-03/supplier-followup-20261103-r8.html'
    assert by_id['gpt-source-followup-r8-evidence-20261103']['url'] == '../research/2026-11-03/supplier-followup-20261103-r8-evidence.json'
    assert by_id['gpt-source-followup-r7-20261103']['url'] == '../research/2026-11-03/supplier-followup-20261103-r7.html'
    assert by_id['gpt-source-followup-r7-evidence-20261103']['url'] == '../research/2026-11-03/supplier-followup-20261103-r7-evidence.json'
    assert by_id['gpt-source-followup-r6-20261103']['url'] == '../research/2026-11-03/supplier-followup-20261103-r6.html'
    assert by_id['gpt-source-followup-r6-evidence-20261103']['url'] == '../research/2026-11-03/supplier-followup-20261103-r6-evidence.json'
    assert by_id['gpt-source-followup-r5-20261103']['url'] == '../research/2026-11-03/supplier-followup-20261103-r5.html'
    assert by_id['gpt-source-followup-r5-evidence-20261103']['url'] == '../research/2026-11-03/supplier-followup-20261103-r5-evidence.json'
    assert by_id['gpt-source-followup-r4-20261103']['url'] == '../research/2026-11-03/supplier-followup-20261103-r4.html'
    assert by_id['gpt-source-followup-r4-evidence-20261103']['url'] == '../research/2026-11-03/supplier-followup-20261103-r4-evidence.json'
    assert by_id['gpt-source-followup-r2-20261103']['url'] == '../research/2026-11-03/supplier-followup-20261103-r2.html'
    assert by_id['gpt-source-followup-r2-evidence-20261103']['url'] == '../research/2026-11-03/supplier-followup-20261103-r2-evidence.json'
    assert by_id['gpt-source-followup-r3-20261103']['url'] == '../research/2026-11-03/supplier-followup-20261103-r3.html'
    assert by_id['gpt-source-followup-r3-evidence-20261103']['url'] == '../research/2026-11-03/supplier-followup-20261103-r3-evidence.json'
    assert by_id['paper-learning-site']['task'] == 'project-6' and by_id['paper-learning-site']['url'] == 'https://1337816143.github.io/Paper/'
    assert by_id['farm-system-site']['task'] == 'project-5' and by_id['farm-system-site']['url'] == 'https://1337816143.github.io/FarmSystemDesign/#research'
    projects = {p['name']: p for p in json.loads((ROOT / 'data/projects.json').read_bytes())['projects']}
    assert re.search(r'v\d+\.\d+\.\d+', projects['FarmSystemDesign农业系统平台']['progress']) and '未实现' in projects['FarmSystemDesign农业系统平台']['gaps']
    assert '练习题、错题和知识自测' in projects['Paper论文学习平台']['gaps']
    # r35 self-service banner is an observed merchant notice, not a backend outage test.
    assert by_id['gpt-source-followup-r35-20261104']['url'] == '../research/2026-11-04/supplier-followup-20261104-r21.html'
    assert by_id['gpt-source-followup-r35-20261104-evidence']['url'] == '../research/2026-11-04/supplier-followup-20261104-r21-evidence.json'
    r35 = json.loads((ROOT / 'dist/research/2026-11-04/supplier-followup-20261104-r21-evidence.json').read_bytes())
    assert r35['round'] == 35 and r35['service_status']['backend_outage_confirmed'] is False
    assert r35['service_status']['actual_paid_plus_cny'] is None and r35['service_status']['invoice_fee_cny'] is None
    assert r35['phone_verification']['verified_success_count'] == 0
    assert r35['qualification_totals']['new_verified_plus_wholesale_upstreams'] == 0
    from validate_current_updates import validate_current_updates
    validate_current_updates()
    from validate_task35 import validate_task35, negative_tests
    validate_task35(); negative_tests()
    print('PASS: approved exact public artifacts, preserved historical evidence, two pinned archives, return/download links and evidence boundaries')


if __name__ == '__main__': validate_publications()
