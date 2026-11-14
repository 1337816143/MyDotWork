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
    assert catalog['counts'] == {'artifacts': 409, 'websites': 6, 'tasks': 18}
    manifest = json.loads((ROOT / 'dist/release-manifest.json').read_bytes())
    latest = manifest['latestResearchSupplement']
    assert latest['version'] == '1.188'
    assert latest['date'] == '2026-11-14'
    assert latest['path'] == 'research/2026-11-14/supplier-followup-20261114-r16.html'
    assert latest['dataPath'] == 'research/2026-11-14/supplier-followup-20261114-r16-evidence.json'
    assert latest['previousPath'] == 'research/2026-11-14/supplier-followup-20261114-r15.html'

    # R187: CatFK separate seller and exact SMS SKU limits; index price and unpaid preview are not real checkout.
    assert by_id['gpt-source-followup-r187-20261114']['url'].endswith('supplier-followup-20261114-r15.html')
    assert by_id['gpt-source-followup-r187-20261114-evidence']['url'].endswith('supplier-followup-20261114-r15-evidence.json')
    r187 = json.loads((ROOT/'dist/research/2026-11-14/supplier-followup-20261114-r15-evidence.json').read_bytes())
    assert r187['round'] == 187 and r187['site_version'] == '1.9.195'
    sms187 = r187['independent_phone']
    assert sms187['number_control_period_minutes_merchant_claim'] == 20
    assert sms187['second_or_repeat_verification_supported_merchant_claim'] is False
    assert sms187['third_party_index_display_price_cny_per_one_code'] == 3
    assert sms187['direct_merchant_page_price_verified_cny'] is None
    assert sms187['refund_to_original_payment_guaranteed'] is False
    assert sms187['actual_sms_passed_tested'] is False
    plus187 = r187['plus']
    assert plus187['existing_period_overwritten_not_accumulated_claim'] is True
    assert plus187['all_required_fees_valid_china_vat_cny'] is None
    assert plus187['eligible_qualified_upstream'] is False
    assert r187['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert r187['qualification_totals']['verified_phone_sms_successes'] == 0
    assert r187['historical_126_prices_modified'] is False
    assert r187['actual_purchase_or_sms_test_performed'] is False

    # R186 newly read retailer: old base price + conflicting invoice rates are conditional, not a verified payable invoice total.
    assert by_id['gpt-source-followup-r186-20261114']['url'].endswith('supplier-followup-20261114-r14.html')
    assert by_id['gpt-source-followup-r186-20261114-evidence']['url'].endswith('supplier-followup-20261114-r14-evidence.json')
    r186 = json.loads((ROOT/'dist/research/2026-11-14/supplier-followup-20261114-r14-evidence.json').read_bytes())
    assert r186['round'] == 186 and r186['site_version'] == '1.9.194'
    assert r186['new_candidate']['plus_sku']['old_blog_base_cny_per_account_month'] == 168
    assert r186['new_candidate']['plus_sku']['current_page_live_plus_price_cny'] is None
    assert r186['new_candidate']['invoicing']['homepage_extra_fee_rate_claim'] == .05
    assert r186['new_candidate']['invoicing']['old_blog_extra_fee_rate_claim'] == .06
    assert r186['new_candidate']['invoicing']['all_payment_fees_with_valid_china_vat_cny'] is None
    assert r186['new_candidate']['credentials']['conflicting_merchant_pages'] is True
    assert r186['new_candidate']['qualified_wholesale'] is False
    assert r186['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert r186['actual_purchase_or_sms_test_performed'] is False

    # R185 separate retail and agent SKU, upfront fee, no valid tax-paid upstream.
    assert by_id['gpt-source-followup-r185-20261114']['url'] == '../research/2026-11-14/supplier-followup-20261114-r13.html'
    assert by_id['gpt-source-followup-r185-20261114-evidence']['url'] == '../research/2026-11-14/supplier-followup-20261114-r13-evidence.json'
    r185 = json.loads((ROOT/'dist/research/2026-11-14/supplier-followup-20261114-r13-evidence.json').read_bytes())
    assert r185['round'] == 185 and r185['site_version'] == '1.9.193'
    assert r185['new_candidate']['retail']['display_cny_per_own_account_month'] == 115
    assert r185['new_candidate']['wholesale_agent']['agent_qualification_upfront_cny'] == 20
    assert r185['new_candidate']['wholesale_agent']['agent_supplier_display_cny_per_undisclosed_unit'] == 120
    assert r185['new_candidate']['wholesale_agent']['retail_sku_same_as_agent_sku_verified'] is False
    assert r185['new_candidate']['full_all_fees_valid_china_vat_cny'] is None
    assert r185['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert r185['actual_purchase_or_sms_test_performed'] is False

    # R184: one-year prepayment, wallet-credit refunds and carrier/SMS compatibility remain seller claims.
    assert by_id['gpt-source-followup-r184-20261114']['url'].endswith('supplier-followup-20261114-r12.html')
    assert by_id['gpt-source-followup-r184-20261114-evidence']['url'].endswith('supplier-followup-20261114-r12-evidence.json')
    r184 = json.loads((ROOT / 'dist/research/2026-11-14/supplier-followup-20261114-r12-evidence.json').read_bytes())
    assert r184['round'] == 184 and r184['site_version'] == '1.9.192'
    assert r184['new_independent_phone_number_provider']['annual_payment_required'] is True
    assert r184['new_independent_phone_number_provider']['display_price_usd_per_number_year'] == 21.60
    assert r184['new_independent_phone_number_provider']['one_month_sku_checkout_price_usd'] is None
    assert r184['new_independent_phone_number_provider']['true_mobile_line_type_independently_verified'] is False
    assert r184['new_independent_phone_number_provider']['guarantee_merchant_claim']['refund_to_original_payment_guaranteed'] is False
    assert r184['new_independent_phone_number_provider']['official_openai_verification_limits']['phone_call_not_supported'] is True
    assert r184['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert r184['qualification_totals']['verified_phone_sms_successes'] == 0
    assert r184['actual_purchase_or_sms_test_performed'] is False

    # R183: retail invoice claim remains unverified and multi-day virtual number is not OpenAI acceptance proof.
    assert by_id['gpt-source-followup-r183-20261114']['url'].endswith('supplier-followup-20261114-r11.html')
    assert by_id['gpt-source-followup-r183-20261114-evidence']['url'].endswith('supplier-followup-20261114-r11-evidence.json')
    r183 = json.loads((ROOT / 'dist/research/2026-11-14/supplier-followup-20261114-r11-evidence.json').read_bytes())
    assert r183['round'] == 183 and r183['site_version'] == '1.9.191'
    assert r183['new_retail_candidate']['listed_cny_per_month'] == 140
    assert r183['new_retail_candidate']['tax_invoice_claim']['valid_china_vat_invoice_independently_verified'] is False
    assert r183['new_retail_candidate']['total_cny_with_all_required_fees_and_valid_vat'] is None
    assert r183['sms_rental']['sku_prices_whole_period_usd']['gb']['seven_days'] == 0.98
    assert r183['sms_rental']['sku_prices_whole_period_usd']['us']['one_day'] == 4.40
    assert r183['sms_rental']['refund_process']['original_payment_method_guaranteed'] is False
    assert r183['sms_rental']['openai_official_voip_numbers_not_supported'] is True
    assert r183['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert r183['actual_purchase_or_sms_test_performed'] is False

    # R182: new merchant's explicit no-invoice status excludes it despite the low retail ticket.
    assert by_id['gpt-source-followup-r182-20261114']['url'].endswith('supplier-followup-20261114-r10.html')
    assert by_id['gpt-source-followup-r182-20261114-evidence']['url'].endswith('supplier-followup-20261114-r10-evidence.json')
    r182 = json.loads((ROOT / 'dist/research/2026-11-14/supplier-followup-20261114-r10-evidence.json').read_bytes())
    assert r182['round'] == 182 and r182['site_version'] == '1.9.190' and len(r182['sources']) == 8
    assert [s['display_price_cny_per_account_month'] for s in r182['new_merchant']['retail_skus']] == [149,159]
    assert r182['new_merchant']['receipt_and_invoice']['seller_claims_valid_china_vat_invoice'] is False
    assert r182['new_merchant']['receipt_and_invoice']['all_in_plus_with_valid_china_vat_cny'] is None
    assert r182['new_merchant']['operator_claim']['domain_control_or_contractual_operator_relationship_independently_verified'] is False
    assert r182['new_merchant']['eligible_upstream_under_user_criteria'] is False
    assert r182['qualification_totals']['verified_plus_wholesale_upstreams'] == 0

    # R170: public $0.01 OpenAI SMS offer has mandatory $40 nonwithdrawable prepay.
    assert by_id['gpt-source-followup-r170-20261113']['url'].endswith('supplier-followup-20261113-r11.html')
    assert by_id['gpt-source-followup-r170-20261113-evidence']['url'].endswith('supplier-followup-20261113-r11-evidence.json')
    r170 = json.loads((ROOT / 'dist/research/2026-11-13/supplier-followup-20261113-r11-evidence.json').read_bytes())
    assert r170['round'] == 170 and r170['site_version'] == '1.9.178' and len(r170['sources']) == 7
    sms170 = r170['independent_sms_candidate']
    assert sms170['exact_service_code'] == 'openai'
    assert sms170['merchant_public_prices_by_country'][0]['price_usd_per_one_sms_code'] == 0.01
    assert sms170['minimum_prepaid_crypto_topup_usd'] == 40
    assert sms170['prepaid_balance_withdrawable'] is False
    assert sms170['actual_one_order_out_of_pocket_usd'] is None
    assert all(x == 0 for x in r170['qualification_totals'].values())

    # R169: independently observed CODASMS SMS reseller approval terms are not Plus supply authorization.
    assert by_id['gpt-source-followup-r169-20261113']['url'].endswith('supplier-followup-20261113-r10.html')
    assert by_id['gpt-source-followup-r169-20261113-evidence']['url'].endswith('supplier-followup-20261113-r10-evidence.json')
    r169 = json.loads((ROOT / 'dist/research/2026-11-13/supplier-followup-20261113-r10-evidence.json').read_bytes())
    assert r169['round'] == 169 and r169['site_version'] == '1.9.177' and len(r169['sources']) == 7
    sms169 = r169['independent_sms_reseller_candidate']
    assert sms169['exact_openai_service_code'] is None
    assert sms169['exact_openai_single_sms_reseller_cost_usd'] is None
    assert sms169['reseller_approval_required'] is True
    assert sms169['written_resale_permission_required'] is True
    assert sms169['minimum_initial_funding_usd'] is None
    assert sms169['zero_upfront_fee_verified'] is False
    assert sms169['actual_cash_refund_verified'] is False
    assert all(v == 0 for v in r169['qualification_totals'].values())

    # R143: Apple recovery may cause double charge, not merchant payment test.
    assert by_id['gpt-source-followup-r143-20261111']['url'].endswith('supplier-followup-20261111-r16.html')
    assert by_id['gpt-source-followup-r143-20261111-evidence']['url'].endswith('supplier-followup-20261111-r16-evidence.json')
    r143 = json.loads((ROOT/'dist/research/2026-11-11/supplier-followup-20261111-r16-evidence.json').read_bytes())
    assert r143['round'] == 143 and r143['site_version'] == '1.9.151' and len(r143['sources']) == 2
    assert r143['new_evidence']['official_apple_payment_recovery']['apple_failed_renewal_automatically_cancels_subscription'] is False
    assert r143['new_evidence']['official_apple_payment_recovery']['parallel_web_or_google_subscription_may_duplicate_charges'] is True
    assert r143['new_evidence']['official_apple_payment_recovery']['separately_purchased_subscriptions_automatically_entitled_to_refund'] is False
    assert r143['supply_reassessment']['all_required_plus_fees_with_valid_china_vat_total_cny'] is None
    assert r143['qualification_totals']['verified_plus_wholesale_upstreams'] == 0

    # R142: official currently available Pro tiers, not a verified reseller fulfilment.
    assert by_id['gpt-source-followup-r142-20261111']['url'] == '../research/2026-11-11/supplier-followup-20261111-r15.html'
    assert by_id['gpt-source-followup-r142-20261111-evidence']['url'] == '../research/2026-11-11/supplier-followup-20261111-r15-evidence.json'
    r142 = json.loads((ROOT / 'dist/research/2026-11-11/supplier-followup-20261111-r15-evidence.json').read_bytes())
    assert r142['round'] == 142 and r142['site_version'] == '1.9.150' and len(r142['sources']) == 2
    d142 = r142['new_evidence']['official_pro_tiers']
    assert (d142['pro_100_usd_per_month'], d142['pro_200_usd_per_month'], d142['pro_500_usd_per_month']) == (100, 200, 500)
    assert d142['pro_200_new_subscriptions_currently_available'] is True
    assert d142['pro_individual_annual_billing_available'] is False
    assert d142['named_merchant_delivery_or_authorization_verified'] is False
    assert r142['supply_reassessment']['all_required_plus_fees_with_valid_china_vat_total_cny'] is None
    assert r142['qualification_totals']['verified_plus_wholesale_upstreams'] == r142['qualification_totals']['verified_phone_sms_successes'] == 0

    # R141: official mobile-store account association, not a confirmed merchant failure or phone bypass.
    assert by_id['gpt-source-followup-r141-20261111']['url'] == '../research/2026-11-11/supplier-followup-20261111-r14.html'
    assert by_id['gpt-source-followup-r141-20261111-evidence']['url'] == '../research/2026-11-11/supplier-followup-20261111-r14-evidence.json'
    r141 = json.loads((ROOT / 'dist/research/2026-11-11/supplier-followup-20261111-r14-evidence.json').read_bytes())
    assert r141['round'] == 141 and r141['site_version'] == '1.9.149' and len(r141['sources']) == 1
    d141 = r141['new_evidence']['official_mobile_subscription_binding']
    assert d141['mobile_purchase_linked_to_store_account_and_chatgpt_account'] is True
    assert d141['restore_purchases_transfers_to_another_chatgpt_account'] is False
    assert d141['apple_account_previously_used_may_block_other_chatgpt_account_purchase_even_after_expiry'] is True
    assert d141['google_play_account_previously_used_may_block_other_chatgpt_account_purchase_even_after_expiry'] is True
    assert d141['apple_purchase_auto_binds_phone_number'] is False
    assert d141['any_named_merchant_verified_to_have_hit_this_block'] is False
    assert r141['supply_reassessment']['all_required_fees_with_valid_china_vat_total_cny'] is None
    assert r141['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert r141['qualification_totals']['verified_phone_sms_successes'] == 0
    # R140: New official card/device policy evidence, not actual seller failure or paid refund.
    assert by_id['gpt-source-followup-r140-20261111']['url'] == '../research/2026-11-11/supplier-followup-20261111-r13.html'
    assert by_id['gpt-source-followup-r140-20261111-evidence']['url'] == '../research/2026-11-11/supplier-followup-20261111-r13-evidence.json'
    r140 = json.loads((ROOT / 'dist/research/2026-11-11/supplier-followup-20261111-r13-evidence.json').read_bytes())
    assert r140['round'] == 140 and r140['site_version'] == '1.9.148' and len(r140['sources']) == 1
    d140 = r140['new_evidence']['official_card_and_device_limits']
    assert d140['too_many_subscriptions_same_card_or_device_may_block_checkout'] is True
    assert d140['device_limit_may_prevent_use_even_after_successful_purchase'] is True
    assert d140['per_card_or_device_numeric_threshold_published'] is None
    assert d140['merchant_specific_fulfillment_failure_verified'] is False
    assert r140['supply_reassessment']['all_required_fees_with_valid_china_vat_total_cny'] is None
    assert r140['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert r140['qualification_totals']['verified_phone_sms_successes'] == 0
    # R137: a two-text 30-day SKU is not a lasting phone; same-page prices conflict and mainland sales are excluded.
    assert by_id['gpt-source-followup-r137-20261111']['url'] == '../research/2026-11-11/supplier-followup-20261111-r10.html'
    assert by_id['gpt-source-followup-r137-20261111-evidence']['url'] == '../research/2026-11-11/supplier-followup-20261111-r10-evidence.json'
    r137 = json.loads((ROOT/'dist/research/2026-11-11/supplier-followup-20261111-r10-evidence.json').read_bytes())
    assert r137['round']==137 and r137['site_version']=='1.9.145' and len(r137['sources'])==8
    assert r137['new_evidence']['goodshopit_plus']['sku_page_prominent_price_cny']==119
    assert r137['new_evidence']['goodshopit_plus']['sku_page_specification_price_cny_per_single_month']==111
    assert r137['new_evidence']['goodshopit_plus']['actual_single_item_checkout_cny'] is None
    assert r137['new_evidence']['goodshopit_plus']['mainland_china_users_excluded_by_seller_notice'] is True
    assert r137['new_evidence']['independent_sms']['offers'][0]['merchant_claim_max_sms']==2
    assert r137['new_evidence']['independent_sms']['offers'][0]['ends_on_second_message_even_before_30_days'] is True
    assert r137['new_evidence']['independent_sms']['real_phone_sms_successes']==0
    assert r137['qualification_totals']['verified_plus_wholesale_upstreams']==0
    # R136: advertised self-service wholesale levels are not proven one-unit purchase costs, legal resale rights, or VAT invoices.
    assert by_id['gpt-source-followup-r136-20261111']['url'] == '../research/2026-11-11/supplier-followup-20261111-r9.html'
    assert by_id['gpt-source-followup-r136-20261111-evidence']['url'] == '../research/2026-11-11/supplier-followup-20261111-r9-evidence.json'
    r136 = json.loads((ROOT/'dist/research/2026-11-11/supplier-followup-20261111-r9-evidence.json').read_bytes())
    assert r136['round'] == 136 and r136['site_version'] == '1.9.144' and len(r136['sources']) == 11
    a136 = r136['new_evidence']['aibulk']
    assert a136['public_guest_lv1_display_price'] == 17.99
    assert a136['quantity_min_registered_claim'] == 1 and a136['merchant_level_thresholds_usd_equivalent']['Lv2'] == 500
    assert a136['actual_logged_in_level_specific_plus_wholesale_price'] is None
    assert a136['session_json_required_for_redemption'] is True
    assert a136['merchant_claim_downstream_fulfillment_provider_receives_required_account_details'] is True
    assert a136['china_vat_invoice_fee_cny'] is None and a136['all_in_paid_valid_china_vat_cny'] is None
    assert a136['formal_upstream_resale_authorization_verified'] is False and a136['qualified'] is False
    assert r136['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert r136['qualification_totals']['verified_phone_sms_successes'] == 0

    # R135: distinct SKUs; merchant-stock and official-refund terms are not paid tests.
    assert by_id['gpt-source-followup-r135-20261111']['url'] == '../research/2026-11-11/supplier-followup-20261111-r8.html'
    assert by_id['gpt-source-followup-r135-20261111-evidence']['url'] == '../research/2026-11-11/supplier-followup-20261111-r8-evidence.json'
    r135=json.loads((ROOT / 'dist/research/2026-11-11/supplier-followup-20261111-r8-evidence.json').read_bytes())
    assert r135['round']==135 and r135['site_version']=='1.9.143' and len(r135['sources'])==2
    assert r135['new_evidence']['yxab_sku_transition']['historical_sku']=='G69666080'
    assert r135['new_evidence']['yxab_sku_transition']['new_sku']=='G62975691'
    assert r135['new_evidence']['yxab_sku_transition']['new_sku_public_price_cny_per_account_month']==128.80
    assert r135['new_evidence']['yxab_sku_transition']['old_and_new_exact_same_product_or_stock_recovery_verified'] is None
    assert r135['new_evidence']['yxab_sku_transition']['merchant_claims_takes_fraction_of_openai_refunded_funds']==0.20
    assert r135['new_evidence']['yxab_sku_transition']['all_in_paid_valid_china_vat_cny'] is None
    assert len(r135['failed_access'])==2 and r135['qualification_totals']['verified_plus_wholesale_upstreams']==0

    # R134: wallet credit is not cash refund, and same-day directory/detail are different public price displays.
    assert by_id['gpt-source-followup-r134-20261111']['url'] == '../research/2026-11-11/supplier-followup-20261111-r7.html'
    assert by_id['gpt-source-followup-r134-20261111-evidence']['url'] == '../research/2026-11-11/supplier-followup-20261111-r7-evidence.json'
    r134 = json.loads((ROOT / 'dist/research/2026-11-11/supplier-followup-20261111-r7-evidence.json').read_bytes())
    assert r134['round'] == 134 and r134['site_version'] == '1.9.142' and len(r134['sources']) == 11
    assert r134['new_evidence']['ershuiai_codex_sms']['public_price_cny_per_one_time_code'] == 5
    assert r134['new_evidence']['ershuiai_codex_sms']['post_delivery_wallet_credit_days_claim'] == 3
    assert r134['new_evidence']['ershuiai_codex_sms']['original_payment_cash_refund_verified'] is None
    assert r134['new_evidence']['buygpt_plus']['catalog_page_display_cny_per_account_month'] == 149
    assert r134['new_evidence']['buygpt_plus']['product_page_promotion_display_cny_per_account_month'] == 139
    assert r134['new_evidence']['buygpt_plus']['actual_paid_price_cny'] is None
    assert r134['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert r134['qualification_totals']['verified_phone_sms_successes'] == 0

    # R133: unpaid promo is not VAT wholesale; upstream tokens and backup retention unverified.
    assert by_id['gpt-source-followup-r133-20261111']['url'] == '../research/2026-11-11/supplier-followup-20261111-r6.html'
    assert by_id['gpt-source-followup-r133-20261111-evidence']['url'] == '../research/2026-11-11/supplier-followup-20261111-r6-evidence.json'
    r133 = json.loads((ROOT / 'dist/research/2026-11-11/supplier-followup-20261111-r6-evidence.json').read_bytes())
    assert r133['round'] == 133 and r133['site_version'] == '1.9.141' and len(r133['sources']) == 8
    assert r133['new_evidence']['chatgptchongzhi']['unpaid_checkout_preview_payable_cny'] == 139
    assert r133['new_evidence']['chatgptchongzhi']['actual_paid_with_valid_china_vat_total_cny'] is None
    assert r133['new_evidence']['chatgptchongzhi']['merchant_receives_access_token_claim'] is True
    assert r133['new_evidence']['chatgptchongzhi']['physical_backup_deletion_days_verified'] is None
    assert r133['qualification_totals']['verified_plus_wholesale_upstreams'] == 0

    # R132 first-party ad: invoice-option arithmetic is not VAT proof; ¥3000 mandatory agency fee excludes wholesaler qualification.
    assert by_id['gpt-source-followup-r132-20261111']['url'] == '../research/2026-11-11/supplier-followup-20261111-r5.html'
    assert by_id['gpt-source-followup-r132-20261111-evidence']['url'] == '../research/2026-11-11/supplier-followup-20261111-r5-evidence.json'
    r132 = json.loads((ROOT / 'dist/research/2026-11-11/supplier-followup-20261111-r5-evidence.json').read_bytes())
    assert r132['round'] == 132 and r132['site_version'] == '1.9.140' and len(r132['sources']) == 9
    assert r132['new_evidence']['aiplusgate']['apple_invoice_option_advertised_total_cny'] == 168
    assert r132['new_evidence']['aiplusgate']['actual_paid_with_valid_china_vat_total_cny'] is None
    assert r132['new_evidence']['chatgqt_plus']['agency_restock_precondition_fee_cny'] == 3000
    assert r132['new_evidence']['chatgqt_plus']['agency_restock_fee_separate_from_goods_balance'] is True
    assert r132['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert r132['qualification_totals']['verified_phone_sms_successes'] == 0

    # R131: GPTPro is retail and exceeds all-fees ceiling on seller's advertised invoice option; SMS is one-time, not 30 days.
    assert by_id['gpt-source-followup-r131-20261111']['url'] == '../research/2026-11-11/supplier-followup-20261111-r4.html'
    assert by_id['gpt-source-followup-r131-20261111-evidence']['url'] == '../research/2026-11-11/supplier-followup-20261111-r4-evidence.json'
    r131 = json.loads((ROOT / 'dist/research/2026-11-11/supplier-followup-20261111-r4-evidence.json').read_bytes())
    assert r131['round'] == 131 and r131['site_version'] == '1.9.139' and len(r131['sources']) == 8
    assert r131['new_evidence']['gptpro5x']['public_retail_base_price_cny_per_account_month'] == 168
    assert r131['new_evidence']['gptpro5x']['base_plus_invoice_arithmetic_cny'] == 178.08
    assert r131['new_evidence']['gptpro5x']['actual_paid_with_valid_china_vat_total_cny'] is None
    assert r131['new_evidence']['codex_sms']['public_price_per_one_time_verification_cny'] == 10
    assert r131['new_evidence']['codex_sms']['merchant_claims_second_sms_supported'] is False
    assert r131['new_evidence']['codex_sms']['number_control_days_verified'] is None
    assert r131['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert r131['qualification_totals']['verified_phone_sms_successes'] == 0

    # R130: Plus6/GPTDCVIP are separate retail leads; no approved wholesale, VAT or SMS verification.
    assert by_id['gpt-source-followup-r130-20261111']['url'] == '../research/2026-11-11/supplier-followup-20261111-r3.html'
    assert by_id['gpt-source-followup-r130-20261111-evidence']['url'] == '../research/2026-11-11/supplier-followup-20261111-r3-evidence.json'
    r130 = json.loads((ROOT / 'dist/research/2026-11-11/supplier-followup-20261111-r3-evidence.json').read_bytes())
    assert r130['round'] == 130 and r130['site_version'] == '1.9.138' and len(r130['sources']) == 7
    assert r130['new_evidence']['plus6']['public_retail_cny_per_account_month'] == 145
    assert r130['new_evidence']['plus6']['merchant_says_forwards_session_to_third_party_verification_api'] is True
    assert r130['new_evidence']['plus6']['independent_codex_sms_price_cny'] is None
    assert r130['new_evidence']['gptdcvip']['public_retail_cny_per_account_month'] == 139
    assert r130['new_evidence']['gptdcvip']['merchant_requires_existing_logged_in_session_json'] is True
    assert r130['qualification_totals']['verified_plus_wholesale_upstreams'] == 0

    # R129: GetPlus enterprise minimum and mainland exclusion are new direct reads of old terms.
    assert by_id['gpt-source-followup-r129-20261111']['url'] == '../research/2026-11-11/supplier-followup-20261111-r2.html'
    assert by_id['gpt-source-followup-r129-20261111-evidence']['url'] == '../research/2026-11-11/supplier-followup-20261111-r2-evidence.json'
    r129 = json.loads((ROOT / 'dist/research/2026-11-11/supplier-followup-20261111-r2-evidence.json').read_bytes())
    assert r129['round']==129 and r129['site_version']=='1.9.137' and len(r129['sources'])==5
    assert r129['new_evidence']['enterprise_minimum_quantity']==5
    assert r129['new_evidence']['merchant_terms_disallow_orders_physically_within_mainland_china'] is True
    assert r129['new_evidence']['retail_single_usd_per_month']==22.14
    assert r129['new_evidence']['actual_paid_with_valid_china_vat_total_cny'] is None
    assert r129['qualification_totals']['verified_plus_wholesale_upstreams']==0
    # R128: old, newly read October merchant terms reveal conditional refunds and no SMS-result guarantee.
    assert by_id['gpt-source-followup-r128-20261111']['url'] == '../research/2026-11-11/supplier-followup-20261111.html'
    assert by_id['gpt-source-followup-r128-20261111-evidence']['url'] == '../research/2026-11-11/supplier-followup-20261111-evidence.json'
    r128 = json.loads((ROOT/'dist/research/2026-11-11/supplier-followup-20261111-evidence.json').read_bytes())
    assert r128['round'] == 128 and r128['site_version'] == '1.9.136' and len(r128['sources']) == 7
    assert r128['new_evidence']['existing_account_sku_public_retail_cny_per_account_month'] == 155
    assert r128['new_evidence']['warranty_compensation_requires_matching_official_refund_email'] is True
    assert r128['new_evidence']['merchant_guarantees_successful_sms_or_openai_verification'] is False
    assert r128['new_evidence']['actual_paid_all_required_fees_with_valid_china_vat_cny'] is None
    assert r128['historical_comparison']['newly_read_old_dated_terms_are_new_policy_changes'] is False
    assert r128['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert r128['qualification_totals']['verified_phone_sms_successes'] == 0
    # R127: storefront listing difference is not a verified wholesale cost, tax invoice or phone bypass.
    assert by_id['gpt-source-followup-r127-20261110']['url'] == '../research/2026-11-10/supplier-followup-20261110-r14.html'
    assert by_id['gpt-source-followup-r127-20261110-evidence']['url'] == '../research/2026-11-10/supplier-followup-20261110-r14-evidence.json'
    r127 = json.loads((ROOT / 'dist/research/2026-11-10/supplier-followup-20261110-r14-evidence.json').read_bytes())
    assert r127['round'] == 127 and r127['site_version'] == '1.9.135' and len(r127['sources']) == 9
    assert r127['new_evidence']['catfk_display_unit_price_cny'] == 113
    assert r127['new_evidence']['direct_display_unit_price_cny'] == 110
    assert r127['new_evidence']['actual_single_unit_wholesale_unit_price_cny'] is None
    assert r127['new_evidence']['valid_china_vat_total_cny'] is None
    assert r127['new_evidence']['demonstrated_new_price_change'] is False
    assert r127['new_evidence']['bank_receipt_is_china_vat_invoice'] is False
    assert r127['phone_verification']['codex_credit_is_sms'] is False
    assert r127['qualification_totals']['verified_plus_wholesale_upstreams'] == r127['qualification_totals']['verified_phone_sms_successes'] == 0
    # R126: Wholesale levels for Go do not verify Plus and a retail ban blocks resale.
    assert by_id['gpt-source-followup-r126-20261110']['url'] == '../research/2026-11-10/supplier-followup-20261110-r13.html'
    assert by_id['gpt-source-followup-r126-20261110-evidence']['url'] == '../research/2026-11-10/supplier-followup-20261110-r13-evidence.json'
    r126 = json.loads((ROOT/'dist/research/2026-11-10/supplier-followup-20261110-r13-evidence.json').read_bytes())
    assert r126['round'] == 126 and r126['site_version'] == '1.9.134' and len(r126['sources']) == 8
    assert r126['new_evidence']['dingyue']['actual_plus_wholesale_unit_usd'] is None
    assert r126['new_evidence']['dingyue']['api_docs_example_is_actual_wholesale_price'] is False
    assert r126['new_evidence']['token5555']['unpaid_display_total_cny'] == 149.78
    assert r126['new_evidence']['token5555']['merchant_terms_ban_resale'] is True
    assert r126['new_evidence']['token5555']['all_fees_with_valid_china_vat_cny'] is None
    assert r126['qualification_totals']['verified_plus_wholesale_upstreams'] == r126['qualification_totals']['verified_phone_sms_successes'] == 0
    # R125: matching bilingual live marketing display but same old unpaid checkout; never infer real paid price change.
    assert by_id['gpt-source-followup-r125-20261110']['url'] == '../research/2026-11-10/supplier-followup-20261110-r12.html'
    assert by_id['gpt-source-followup-r125-20261110-evidence']['url'] == '../research/2026-11-10/supplier-followup-20261110-r12-evidence.json'
    r125 = json.loads((ROOT/'dist/research/2026-11-10/supplier-followup-20261110-r12-evidence.json').read_bytes())
    assert r125['round'] == 125 and r125['site_version'] == '1.9.133' and len(r125['sources']) == 4
    assert r125['historical_comparison']['previous_english_product_display_usd'] == 3.49
    assert r125['new_evidence']['english_product_display_usd_per_number'] == r125['new_evidence']['chinese_product_display_usd_per_number'] == 4.99
    assert r125['new_evidence']['unpaid_checkout_total_usd'] == 5.24
    assert r125['new_evidence']['unpaid_checkout_base_and_total_changed_vs_r118'] is False
    assert r125['new_evidence']['actual_paid_total_usd'] is None
    assert r125['new_evidence']['realized_price_increase_proven'] is False
    assert r125['qualification_totals']['verified_plus_wholesale_upstreams'] == r125['qualification_totals']['verified_phone_sms_successes'] == 0
    # R124: vendor coupon only after completion and never a verified SMS success.
    assert by_id['gpt-source-followup-r124-20261110']['url'] == '../research/2026-11-10/supplier-followup-20261110-r11.html'
    assert by_id['gpt-source-followup-r124-20261110-evidence']['url'] == '../research/2026-11-10/supplier-followup-20261110-r11-evidence.json'
    r124 = json.loads((ROOT / 'dist/research/2026-11-10/supplier-followup-20261110-r11-evidence.json').read_bytes())
    assert r124['round'] == 124 and r124['site_version'] == '1.9.132' and len(r124['sources']) == 5
    assert r124['new_evidence']['plus_current_retail_cny_per_account_month'] is None
    assert r124['new_evidence']['coupon']['max_coupon_count_at_completed_higher_tier'] == 3
    assert r124['phone_verification']['codex_desktop_success_verified'] is False
    assert r124['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    # R123: Same-day first-party invoice eligibility contradiction, not verified real invoice.
    assert by_id['gpt-source-followup-r123-20261110']['url'] == '../research/2026-11-10/supplier-followup-20261110-r10.html'
    assert by_id['gpt-source-followup-r123-20261110-evidence']['url'] == '../research/2026-11-10/supplier-followup-20261110-r10-evidence.json'
    r123 = json.loads((ROOT / 'dist/research/2026-11-10/supplier-followup-20261110-r10-evidence.json').read_bytes())
    assert r123['round'] == 123 and r123['site_version'] == '1.9.131' and len(r123['sources']) == 7
    assert r123['new_evidence']['storefront_says_guest_order_can_invoice_after_signin_with_original_order_email'] is True
    assert r123['new_evidence']['invoice_guide_says_guest_order_has_no_invoice_entry'] is True
    assert r123['new_evidence']['actual_guest_invoice_success_verified'] is None
    assert r123['new_evidence']['actual_paid_all_in_with_valid_china_vat_cny'] is None
    assert r123['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    # R122: catalogue/manifest refer to latest bounded warranty-label observation; R121 assertions retained.
    assert by_id['gpt-source-followup-r122-20261110']['url'] == '../research/2026-11-10/supplier-followup-20261110-r9.html'
    assert by_id['gpt-source-followup-r122-20261110-evidence']['url'] == '../research/2026-11-10/supplier-followup-20261110-r9-evidence.json'
    r122=json.loads((ROOT/'dist/research/2026-11-10/supplier-followup-20261110-r9-evidence.json').read_bytes())
    assert r122['round']==122 and r122['site_version']=='1.9.130' and len(r122['sources'])==4
    assert r122['historical_comparison']['round']==78 and len(r122['historical_comparison']['old_skus'])==2
    assert r122['historical_comparison']['old_skus'][0]['warranty_mark'] is False
    assert r122['new_evidence']['merchant_claim_warranty_days']==30
    assert r122['new_evidence']['verified_mapping_of_old_two_skus_to_new_generic_sku'] is None
    assert r122['new_evidence']['actual_paid_all_in_with_china_vat_cny'] is None
    assert r122['qualification_totals']['verified_plus_wholesale_upstreams']==0
    assert by_id['gpt-source-followup-r121-20261110']['url'] == '../research/2026-11-10/supplier-followup-20261110-r8.html'
    assert by_id['gpt-source-followup-r121-20261110-evidence']['url'] == '../research/2026-11-10/supplier-followup-20261110-r8-evidence.json'
    r121 = json.loads((ROOT/'dist/research/2026-11-10/supplier-followup-20261110-r8-evidence.json').read_bytes())
    assert r121['round']==121 and r121['site_version']=='1.9.129' and len(r121['sources'])==8
    assert r121['new_evidence']['uppluspro']['advertised_retail_cny_per_account_month']==143
    assert r121['new_evidence']['uppluspro']['advertised_component_sum_cny']==153
    assert r121['new_evidence']['uppluspro']['actual_paid_all_in_with_valid_china_vat_cny'] is None
    assert r121['new_evidence']['gptstore']['advertised_vip_agent_usd_per_card']==16
    assert r121['new_evidence']['gptstore']['public_price_spread_usd']==0
    assert r121['new_evidence']['gptstore']['actual_paid_all_in_with_valid_china_vat_cny'] is None
    assert r121['qualification_totals']['verified_plus_wholesale_upstreams']==0
    assert r121['qualification_totals']['verified_phone_sms_successes']==0
    assert by_id['gpt-source-followup-r120-20261110']['url'] == '../research/2026-11-10/supplier-followup-20261110-r7.html'
    assert by_id['gpt-source-followup-r120-20261110-evidence']['url'] == '../research/2026-11-10/supplier-followup-20261110-r7-evidence.json'
    r120 = json.loads((ROOT/'dist/research/2026-11-10/supplier-followup-20261110-r7-evidence.json').read_bytes())
    assert r120['round']==120 and r120['site_version']=='1.9.128' and len(r120['sources'])==7
    assert r120['new_evidence']['plus']['public_retail_price_cny_per_original_account_month']==148
    assert r120['new_evidence']['plus']['advertised_components_sum_cny']==155.4
    assert r120['new_evidence']['plus']['actual_paid_all_in_with_valid_china_vat_invoice_cny'] is None
    assert r120['new_evidence']['plus']['requires_full_session_json_submission'] is True
    assert r120['new_evidence']['plus']['affiliate_is_wholesale'] is False
    assert r120['new_evidence']['independent_sms']['home_cheap_tier']['advertised_cny_per_number']==4.9
    assert r120['new_evidence']['independent_sms']['home_long_tier']['advertised_cny_per_number']==9.9
    assert r120['new_evidence']['independent_sms']['product_detail_supports_online_order'] is False
    assert r120['new_evidence']['independent_sms']['actual_buyable_sms_price_cny'] is None
    assert r120['new_evidence']['independent_sms']['cash_refund_on_sms_failure'] is None
    assert r120['qualification_totals']['verified_plus_wholesale_upstreams']==0
    assert r120['qualification_totals']['verified_phone_sms_successes']==0
    assert by_id['gpt-source-followup-r119-20261110']['url'] == '../research/2026-11-10/supplier-followup-20261110-r6.html'
    assert by_id['gpt-source-followup-r119-20261110-evidence']['url'] == '../research/2026-11-10/supplier-followup-20261110-r6-evidence.json'
    r119=json.loads((ROOT/'dist/research/2026-11-10/supplier-followup-20261110-r6-evidence.json').read_bytes())
    assert r119['round']==119 and r119['site_version']=='1.9.127' and len(r119['sources'])==8
    r119e=r119['new_evidence']
    assert r119e['reference_gptplus_previous_usdt']==15.8 and r119e['reference_gptplus_current_usdt']==16.2
    assert r119e['reference_display_difference_usdt']==0.4
    assert r119e['authenticated_wholesale_quote_usdt'] is None
    assert r119e['gptplus_google_merchant_claim_non_warranty'] is True
    assert r119e['gptplus_google_actual_drop_risk_verified'] is False
    assert r119e['generic_sms']['openai_specific_price_usdt'] is None
    assert r119e['plus_actual_all_in_with_china_vat_cny'] is None
    assert r119e['qualifies_as_verified_plus_wholesale'] is False
    assert r119['qualification_totals']['verified_plus_wholesale_upstreams']==0
    assert r119['qualification_totals']['verified_phone_sms_successes']==0
    assert by_id['gpt-source-followup-r118-20261110']['url'] == '../research/2026-11-10/supplier-followup-20261110-r5.html'
    assert by_id['gpt-source-followup-r118-20261110-evidence']['url'] == '../research/2026-11-10/supplier-followup-20261110-r5-evidence.json'
    r118 = json.loads((ROOT / 'dist/research/2026-11-10/supplier-followup-20261110-r5-evidence.json').read_bytes())
    assert r118['round'] == 118 and r118['site_version'] == '1.9.126' and len(r118['sources']) == 5
    assert r118['new_evidence']['current_english_product_page_display_usd'] == 3.49
    assert r118['new_evidence']['current_chinese_product_page_display_usd'] == 4.99
    assert r118['new_evidence']['checkout_service_fee_percent_display'] == 5
    assert r118['new_evidence']['checkout_preview_total_usd'] == 5.24
    assert r118['new_evidence']['real_payment_usd'] is None
    assert r118['new_evidence']['price_change_effective_date_verified'] is None
    assert r118['new_evidence']['qualifies_as_plus_wholesale'] is False
    assert r118['qualification_totals']['verified_phone_sms_successes'] == 0
    assert by_id['gpt-source-followup-r117-20261110']['url'] == '../research/2026-11-10/supplier-followup-20261110-r4.html'
    assert by_id['gpt-source-followup-r117-20261110-evidence']['url'] == '../research/2026-11-10/supplier-followup-20261110-r4-evidence.json'
    r117 = json.loads((ROOT / 'dist/research/2026-11-10/supplier-followup-20261110-r4-evidence.json').read_bytes())
    assert r117['round'] == 117 and r117['site_version'] == '1.9.125' and len(r117['sources']) == 5
    assert r117['new_evidence']['public_price_number'] == 0.05 and r117['new_evidence']['price_table_snapshot_date'] == '2026-10-31'
    assert r117['new_evidence']['actual_checkout_live_price_usd'] is None
    assert r117['new_evidence']['minimum_topup_usd'] == 5 and r117['new_evidence']['minimum_card_cash_outlay_arithmetic_usd'] == 5.5
    assert r117['new_evidence']['no_sms_returns_to_platform_balance_merchant_claim'] is True
    assert r117['new_evidence']['cash_refund_no_sms_automatic'] is False
    assert r117['new_evidence']['received_sms_charged_even_if_openai_rejects_merchant_claim'] is True
    assert r117['new_evidence']['qualifies_as_plus_wholesale'] is False
    assert r117['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    r116 = json.loads((ROOT / 'dist/research/2026-11-10/supplier-followup-20261110-r3-evidence.json').read_bytes())
    assert r116['round'] == 116 and r116['site_version'] == '1.9.124'
    assert len(r116['sources']) == 7
    assert r116['new_evidence']['pay2gpt_sms']['public_price_number'] == 3.49
    assert r116['new_evidence']['pay2gpt_sms']['number_control_days_merchant_claim'] == 21
    assert r116['new_evidence']['pay2gpt_sms']['merchant_claim_no_refund_once_any_sms_received'] is True
    assert r116['new_evidence']['yxab_plus_new_sku']['new_sku_id'] == 'G62975691'
    assert r116['new_evidence']['yxab_plus_new_sku']['old_sku_restock_proven'] is False
    assert r116['new_evidence']['yxab_plus_new_sku']['payment_channel_fee_cny'] is None
    assert r116['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    r115 = json.loads((ROOT / 'dist/research/2026-11-10/supplier-followup-20261110-r2-evidence.json').read_bytes())
    assert r115['round'] == 115 and r115['site_version'] == '1.9.123'
    assert r115['correction']['first_observed_merchant_on'] == '2026-11-03'
    assert [rec['round'] for rec in r115['correction']['prior_evidence']] == [13,37,38,114]
    assert len(r115['sources']) == 10 and r115['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert by_id['gpt-source-followup-r112-20261109']['url'] == '../research/2026-11-09/supplier-followup-20261109-r6.html'
    assert by_id['gpt-source-followup-r112-20261109-evidence']['url'] == '../research/2026-11-09/supplier-followup-20261109-r6-evidence.json'
    r112 = json.loads((ROOT / 'dist/research/2026-11-09/supplier-followup-20261109-r6-evidence.json').read_bytes())
    assert r112['round'] == 112 and r112['site_version'] == '1.9.120' and len(r112['sources']) == 8
    assert r112['new_evidence']['gptpro_plus']['merchant_component_math_alipay_with_invoice_cny'] == 178.08
    assert r112['new_evidence']['gptpro_plus']['sensitive_session_json_needed_downstream'] is True
    assert r112['new_evidence']['codex_sms']['merchant_claim_re_receive_sms_supported'] is False
    assert r112['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert by_id['gpt-source-followup-r111-20261109']['url'] == '../research/2026-11-09/supplier-followup-20261109-r5.html'
    assert by_id['gpt-source-followup-r111-20261109-evidence']['url'] == '../research/2026-11-09/supplier-followup-20261109-r5-evidence.json'
    r111 = json.loads((ROOT / 'dist/research/2026-11-09/supplier-followup-20261109-r5-evidence.json').read_bytes())
    assert r111['round'] == 111 and r111['site_version'] == '1.9.119' and len(r111['sources']) == 5
    assert r111['newly_read_terms']['explicitly_forbids_reselling_codes'] is True
    assert r111['newly_read_terms']['page_self_last_updated'] == '2026-08-20'
    assert r111['newly_read_privacy']['upstream_card_suppliers_explicitly_mentioned_as_data_recipients'] is True
    assert r111['historical_candidate_reference']['historical_checkout_preview_cny'] == 149.78
    assert r111['historical_candidate_reference']['price_change_verified_this_round'] is False
    assert r111['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert by_id['gpt-source-followup-r110-20261109']['url'] == '../research/2026-11-09/supplier-followup-20261109-r4.html'
    assert by_id['gpt-source-followup-r110-20261109-evidence']['url'] == '../research/2026-11-09/supplier-followup-20261109-r4-evidence.json'
    r110 = json.loads((ROOT / 'dist/research/2026-11-09/supplier-followup-20261109-r4-evidence.json').read_bytes())
    assert r110['round'] == 110 and r110['site_version'] == '1.9.118' and len(r110['sources']) == 11
    assert r110['new_evidence']['callai_plus']['retail_display_cny_per_account_month'] == 108
    assert r110['new_evidence']['callai_plus']['activation_service_under_maintenance_notice_observed'] is True
    assert r110['new_evidence']['codex_sms']['sms_flow_asks_password_or_email_otp_or_mfa'] is True
    assert r110['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert by_id['gpt-source-followup-r109-20261109']['url'] == '../research/2026-11-09/supplier-followup-20261109-r3.html'
    assert by_id['gpt-source-followup-r109-20261109-evidence']['url'] == '../research/2026-11-09/supplier-followup-20261109-r3-evidence.json'
    r109 = json.loads((ROOT / 'dist/research/2026-11-09/supplier-followup-20261109-r3-evidence.json').read_bytes())
    assert r109['round'] == 109 and r109['site_version'] == '1.9.117' and len(r109['sources']) == 9
    assert r109['new_evidence']['v3_shop']['channel_ph_card']['retail_display_cny_per_one_account_month'] == 133.5
    assert r109['new_evidence']['v3_shop']['channel_ios']['retail_display_cny_per_one_account_month'] == 143.5
    assert r109['new_evidence']['v3_shop']['merchant_display_wechat_payment_fee_percent'] == 3.5
    assert r109['new_evidence']['v3_shop']['valid_china_vat_invoice_issuer_verified'] is None
    assert r109['new_evidence']['v3_shop']['terms_forbid_resale_without_permission'] is True
    assert r109['independent_phone_verification']['unique_openai_codex_sms_price_usd'] is None
    assert r109['independent_phone_verification']['no_sms_original_payment_cash_refund_verified'] is None
    assert r109['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert by_id['gpt-source-followup-r108-20261109']['url'] == '../research/2026-11-09/supplier-followup-20261109-r2.html'
    assert by_id['gpt-source-followup-r108-20261109-evidence']['url'] == '../research/2026-11-09/supplier-followup-20261109-r2-evidence.json'
    r108 = json.loads((ROOT / 'dist/research/2026-11-09/supplier-followup-20261109-r2-evidence.json').read_bytes())
    assert r108['round'] == 108 and r108['site_version'] == '1.9.116' and len(r108['sources']) == 8
    assert r108['new_evidence']['cdkstore']['observed_retail_listed_cny_per_account_month'] == 95
    assert r108['new_evidence']['cdkstore']['seller_explicitly_says_no_vat_invoice'] is True
    assert r108['new_evidence']['cdkstore']['buyer_resale_explicitly_prohibited'] is True
    assert r108['new_evidence']['cdkstore']['verified_actual_checkout_cny'] is None
    assert r108['new_evidence']['cdkstore']['formal_wholesale_supply_resale_authorization_verified'] is None
    assert r108['new_evidence']['cdkstore']['requires_chatgpt_access_token'] is True
    assert r108['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert by_id['gpt-source-followup-r107-20261109']['url'] == '../research/2026-11-09/supplier-followup-20261109.html'
    assert by_id['gpt-source-followup-r107-20261109-evidence']['url'] == '../research/2026-11-09/supplier-followup-20261109-evidence.json'
    r107 = json.loads((ROOT / 'dist/research/2026-11-09/supplier-followup-20261109-evidence.json').read_bytes())
    assert r107['round'] == 107 and r107['site_version'] == '1.9.115' and len(r107['sources']) == 6
    assert r107['new_evidence']['xiyueai_plus']['merchant_listed_price_cny_per_own_account_month'] == 118
    assert r107['new_evidence']['xiyueai_plus']['verified_single_unit_wholesale_cost_cny'] is None
    assert r107['new_evidence']['xiyueai_plus']['all_required_payment_and_valid_china_vat_invoice_cny'] is None
    assert r107['new_evidence']['xiyueai_sms']['merchant_price_cny_per_sms_right'] == 8
    assert r107['new_evidence']['xiyueai_sms']['cash_refund_if_no_sms_verified'] is None
    assert r107['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert by_id['gpt-source-followup-r102-20261108']['url'] == '../research/2026-11-08/supplier-followup-20261108-r14.html'
    assert by_id['gpt-source-followup-r102-20261108-evidence']['url'] == '../research/2026-11-08/supplier-followup-20261108-r14-evidence.json'
    assert by_id['gpt-source-followup-r105-20261108']['url'] == '../research/2026-11-08/supplier-followup-20261108-r17.html'
    assert by_id['gpt-source-followup-r105-20261108-evidence']['url'] == '../research/2026-11-08/supplier-followup-20261108-r17-evidence.json'
    r105 = json.loads((ROOT / 'dist/research/2026-11-08/supplier-followup-20261108-r17-evidence.json').read_bytes())
    assert r105['round'] == 105 and r105['site_version'] == '1.9.113' and len(r105['sources']) == 6
    assert r105['new_evidence']['ai_access_hub']['merchant_display_channel_1_card_payment_cny'] == 119
    assert r105['new_evidence']['ai_access_hub']['merchant_says_alipay_fee_percent'] == 5
    assert r105['new_evidence']['ai_access_hub']['merchant_channel_1_refund_service_fee_percent'] == 20
    assert r105['new_evidence']['quanxin_store']['merchant_display_channel_3_ios_cny'] == 128
    assert r105['new_evidence']['zhang_hao_shang']['verified_current_first_party_price_cny'] is None
    assert r105['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert by_id['gpt-source-followup-r106-20261108']['url'] == '../research/2026-11-08/supplier-followup-20261108-r18.html'
    assert by_id['gpt-source-followup-r106-20261108-evidence']['url'] == '../research/2026-11-08/supplier-followup-20261108-r18-evidence.json'
    r106 = json.loads((ROOT / 'dist/research/2026-11-08/supplier-followup-20261108-r18-evidence.json').read_bytes())
    assert r106['round'] == 106 and r106['site_version'] == '1.9.114' and len(r106['sources']) == 9
    assert r106['new_evidence']['gpt_bu_gei_zhan']['plus_listed_cny_per_card'] == 125
    assert r106['new_evidence']['gpt_bu_gei_zhan']['plus_period_months_confirmed_on_card'] is None
    assert r106['new_evidence']['codex_sms']['merchant_listed_cny_per_receive_right'] == 8
    assert r106['new_evidence']['codex_sms']['rights_expire_after_days'] == 30
    assert r106['new_evidence']['codex_sms']['cash_refund_if_sms_not_received_verified'] is None
    assert r106['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert by_id['gpt-source-followup-r104-20261108']['url'] == '../research/2026-11-08/supplier-followup-20261108-r16.html'
    assert by_id['gpt-source-followup-r104-20261108-evidence']['url'] == '../research/2026-11-08/supplier-followup-20261108-r16-evidence.json'
    r104 = json.loads((ROOT / 'dist/research/2026-11-08/supplier-followup-20261108-r16-evidence.json').read_bytes())
    assert r104['round'] == 104 and r104['site_version'] == '1.9.112' and len(r104['sources']) == 5
    assert r104['new_evidence']['suzhe_ai']['observed_agent_price_cny_per_one_month_cdk'] == 115
    assert r104['new_evidence']['suzhe_ai']['upfront_agent_pass_one_time_cny'] == 29.99
    assert r104['new_evidence']['suzhe_ai']['plus_requires_no_active_subscription'] is True
    assert r104['new_evidence']['suzhe_ai']['all_required_fees_with_verified_china_vat_invoice_cny'] is None
    assert r104['new_evidence']['suzhe_ai']['qualifies_as_verified_wholesale_upstream'] is False
    assert r104['independent_phone_verification']['merchant_claim_no_sms_no_card_consumption'] is True
    assert r104['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert by_id['gpt-source-followup-r103-20261108']['url'] == '../research/2026-11-08/supplier-followup-20261108-r15.html'
    assert by_id['gpt-source-followup-r103-20261108-evidence']['url'] == '../research/2026-11-08/supplier-followup-20261108-r15-evidence.json'
    r103 = json.loads((ROOT / 'dist/research/2026-11-08/supplier-followup-20261108-r15-evidence.json').read_bytes())
    assert r103['round'] == 103 and r103['site_version'] == '1.9.111' and len(r103['sources']) == 7
    assert r103['new_evidence']['payai_plus']['displayed_retail_price_cny_per_account_month'] == 169
    assert r103['new_evidence']['payai_plus']['invoice_application_window_days_merchant_claim'] == 7
    assert r103['new_evidence']['payai_plus']['requires_full_authsession_json_at_third_party_redeem'] is True
    assert r103['new_evidence']['payai_plus']['all_required_fees_with_valid_china_vat_invoice_cny'] is None
    assert r103['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    r102 = json.loads((ROOT / 'dist/research/2026-11-08/supplier-followup-20261108-r14-evidence.json').read_bytes())
    assert r102['round'] == 102 and r102['site_version'] == '1.9.110' and len(r102['sources']) == 11
    assert r102['new_evidence']['xiaoyangplus']['invoice_option_display_cny_per_unit'] == 179
    assert r102['new_evidence']['xiaoyangplus']['invoice_issuer_verified'] is None
    assert r102['new_evidence']['steadflow']['homepage_invoice_option_cny_per_month'] == 180
    assert r102['new_evidence']['steadflow']['merchant_terms_prohibit_resale_and_shared_accounts'] is True
    assert r102['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert by_id['gpt-source-followup-r96-20261108']['url'] == '../research/2026-11-08/supplier-followup-20261108-r8.html'
    assert by_id['gpt-source-followup-r96-20261108-evidence']['url'] == '../research/2026-11-08/supplier-followup-20261108-r8-evidence.json'
    r96 = json.loads((ROOT / 'dist/research/2026-11-08/supplier-followup-20261108-r8-evidence.json').read_bytes())
    assert r96['round'] == 96 and r96['site_version'] == '1.9.104' and len(r96['sources']) == 19
    assert r96['new_candidates'][0]['current_product_checkout_price_cny'] is None
    assert r96['new_candidates'][1]['merchant_checkout_price_cny'] is None
    assert r96['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert by_id['gpt-source-followup-r97-20261108']['url'] == '../research/2026-11-08/supplier-followup-20261108-r9.html'
    assert by_id['gpt-source-followup-r97-20261108-evidence']['url'] == '../research/2026-11-08/supplier-followup-20261108-r9-evidence.json'
    r97 = json.loads((ROOT / 'dist/research/2026-11-08/supplier-followup-20261108-r9-evidence.json').read_bytes())
    assert r97['round'] == 97 and r97['site_version'] == '1.9.105' and len(r97['sources']) == 17
    assert r97['new_evidence']['aisubpro_discounted']['card_prefix'] == 'gpt2-'
    assert r97['new_evidence']['aisubpro_discounted']['ordinary_gpt_card_has_same_restriction_proven'] is False
    assert r97['new_evidence']['okai66_plus']['merchant_retail_cny_per_account_month'] == 165
    assert r97['new_evidence']['okai66_plus']['merchant_invoice_total_cny'] == 183
    assert r97['new_evidence']['okai66_plus']['all_required_fee_and_verified_china_vat_total_cny'] is None
    assert r97['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert r97['phone_verification']['real_sms_successes_web_codex_api'] == 0

    assert by_id['gpt-source-followup-r98-20261108']['url'] == '../research/2026-11-08/supplier-followup-20261108-r10.html'
    assert by_id['gpt-source-followup-r98-20261108-evidence']['url'] == '../research/2026-11-08/supplier-followup-20261108-r10-evidence.json'
    r98 = json.loads((ROOT / 'dist/research/2026-11-08/supplier-followup-20261108-r10-evidence.json').read_bytes())
    assert r98['round'] == 98 and r98['site_version'] == '1.9.106' and len(r98['sources']) == 13
    assert r98['new_evidence']['v2bk']['merchant_explicitly_no_warranty'] is True
    assert r98['new_evidence']['v2bk']['wholesale_per_account_month_cny'] is None
    assert r98['new_evidence']['getplus']['enterprise_purchase_minimum_units'] == 5
    assert r98['new_evidence']['getplus']['checkout_base_price_usd'] is None
    assert r98['new_evidence']['getplus']['phone_field_links_or_verifies_chatgpt_phone'] is False
    assert r98['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert by_id['gpt-source-followup-r99-20261108']['url'] == '../research/2026-11-08/supplier-followup-20261108-r11.html'
    assert by_id['gpt-source-followup-r99-20261108-evidence']['url'] == '../research/2026-11-08/supplier-followup-20261108-r11-evidence.json'
    r99 = json.loads((ROOT / 'dist/research/2026-11-08/supplier-followup-20261108-r11-evidence.json').read_bytes())
    assert r99['round'] == 99 and r99['site_version'] == '1.9.107' and len(r99['sources']) == 15
    assert r99['new_evidence']['linkai']['verified_legal_operator'] is None
    assert r99['new_evidence']['yxab']['official_receipt_is_valid_china_vat_invoice'] is False
    assert r99['new_evidence']['callai_codex']['long_term_same_number_control'] is False
    assert r99['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert by_id['gpt-source-followup-r101-20261108']['url'] == '../research/2026-11-08/supplier-followup-20261108-r13.html'
    assert by_id['gpt-source-followup-r101-20261108-evidence']['url'] == '../research/2026-11-08/supplier-followup-20261108-r13-evidence.json'
    r101 = json.loads((ROOT / 'dist/research/2026-11-08/supplier-followup-20261108-r13-evidence.json').read_bytes())
    assert r101['round'] == 101 and r101['site_version'] == '1.9.109' and len(r101['sources']) == 5
    assert r101['new_evidence']['getgpt_plus']['displayed_plus_one_account_month_retail_cny'] == 138
    assert r101['new_evidence']['getgpt_plus']['merchant_explicitly_cannot_confirm_automated_upstream_operator_and_server_region'] is True
    assert r101['new_evidence']['getgpt_plus']['all_required_fees_with_verified_china_vat_invoice_cny'] is None
    assert r101['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert by_id['gpt-source-followup-r100-20261108']['url'] == '../research/2026-11-08/supplier-followup-20261108-r12.html'
    assert by_id['gpt-source-followup-r100-20261108-evidence']['url'] == '../research/2026-11-08/supplier-followup-20261108-r12-evidence.json'
    r100 = json.loads((ROOT / 'dist/research/2026-11-08/supplier-followup-20261108-r12-evidence.json').read_bytes())
    assert r100['round'] == 100 and r100['site_version'] == '1.9.108' and len(r100['sources']) == 4
    assert r100['new_evidence']['nianhua_ai_store']['public_volume_tier_minimum_units'] == 88
    assert r100['new_evidence']['nianhua_ai_store']['public_volume_tier_price_cny_per_unit'] == 110
    assert r100['new_evidence']['nianhua_ai_store']['plus_entitlement_duration_days'] is None
    assert r100['new_evidence']['nianhua_ai_store']['all_required_fees_and_verified_china_vat_invoice_cny'] is None
    assert r100['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert by_id['gpt-source-followup-r72-20261106']['url'] == '../research/2026-11-06/supplier-followup-20261106-r17.html'
    assert by_id['gpt-source-followup-r72-20261106-evidence']['url'] == '../research/2026-11-06/supplier-followup-20261106-r17-evidence.json'
    r72 = json.loads((ROOT / 'dist/research/2026-11-06/supplier-followup-20261106-r17-evidence.json').read_bytes())
    assert r72['round'] == 72 and r72['site_version'] == '1.9.80' and len(r72['sources']) == 6
    assert r72['new_operator_clarification']['verified_legal_operating_entity'] is None
    assert r72['single_piece_invoice']['invoice_fee_cny'] is None
    assert r72['conditional_promotion']['new_coupon_code'] == '888888'
    assert r72['conditional_promotion']['conditional_retention_math_cny'] == 126
    assert r72['conditional_promotion']['real_checkout_coupon_redeemed_verified'] is False
    assert r72['conditional_promotion']['mandatory_reusable_wallet_predeposit_cny'] == 500
    assert r72['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert by_id['gpt-source-followup-r71-20261106']['url'] == '../research/2026-11-06/supplier-followup-20261106-r16.html'
    assert by_id['gpt-source-followup-r71-20261106-evidence']['url'] == '../research/2026-11-06/supplier-followup-20261106-r16-evidence.json'
    r71 = json.loads((ROOT / 'dist/research/2026-11-06/supplier-followup-20261106-r16-evidence.json').read_bytes())
    assert r71['round'] == 71 and r71['site_version'] == '1.9.79' and len(r71['sources']) == 10
    assert r71['new_candidate']['retail_price_cny_per_account_month'] == 149
    assert r71['new_candidate']['agent_discounts_are_illustrative'] is True
    assert r71['new_candidate']['illustrative_bronze_price_cny'] == 141.55
    assert r71['new_candidate']['actual_one_piece_wholesale_cny'] is None
    assert r71['new_candidate']['actual_one_account_month_invoiced_all_in_cny'] is None
    assert r71['new_candidate']['enterprise_minimum_accounts'] == 5
    assert r71['new_candidate']['wholesale_qualified'] is False
    assert r71['independent_codex_phone_verification']['display_price_cny_per_attempt'] == 12
    assert r71['independent_codex_phone_verification']['sms_failure_original_refund_guaranteed'] is False
    assert r71['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert by_id['gpt-source-followup-r70-20261106']['url'] == '../research/2026-11-06/supplier-followup-20261106-r15.html'
    assert by_id['gpt-source-followup-r70-20261106-evidence']['url'] == '../research/2026-11-06/supplier-followup-20261106-r15-evidence.json'
    r70 = json.loads((ROOT / 'dist/research/2026-11-06/supplier-followup-20261106-r15-evidence.json').read_bytes())
    assert r70['round'] == 70 and r70['site_version'] == '1.9.78' and len(r70['sources']) == 8
    assert r70['new_candidate']['merchant_published_wholesale_cny'] == 112
    assert r70['new_candidate']['mandatory_reusable_wallet_topup_cny'] == 500
    assert r70['new_candidate']['claimed_agent_entry_fee_cny'] == 0
    assert r70['new_candidate']['actual_all_in_cny_for_one_account_month'] is None
    assert r70['new_candidate']['qualified_wholesale'] is False
    assert r70['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert by_id['gpt-source-followup-r69-20261106']['url'] == '../research/2026-11-06/supplier-followup-20261106-r14.html'
    assert by_id['gpt-source-followup-r69-20261106-evidence']['url'] == '../research/2026-11-06/supplier-followup-20261106-r14-evidence.json'
    r69 = json.loads((ROOT / 'dist/research/2026-11-06/supplier-followup-20261106-r14-evidence.json').read_bytes())
    assert r69['round'] == 69 and r69['site_version'] == '1.9.77' and len(r69['sources']) == 10
    assert r69['new_candidate_unverified']['displayed_price'] == 14.93 and r69['new_candidate_unverified']['merchant_admits_partner_supplier'] is True
    assert r69['new_candidate_unverified']['all_required_costs_including_china_vat_cny'] is None
    assert r69['prior_candidate_material_clarification']['asks_to_paste_entire_account_info_page'] is True
    assert r69['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert by_id['gpt-source-followup-r68-20261106']['url'] == '../research/2026-11-06/supplier-followup-20261106-r13.html'
    assert by_id['gpt-source-followup-r68-20261106-evidence']['url'] == '../research/2026-11-06/supplier-followup-20261106-r13-evidence.json'
    r68 = json.loads((ROOT / 'dist/research/2026-11-06/supplier-followup-20261106-r13-evidence.json').read_bytes())
    assert r68['round'] == 68 and r68['site_version'] == '1.9.76'
    assert len(r68['sources']) == 14
    assert [x['displayed_price_cny_per_account_month'] for x in r68['new_retail_candidates_unverified'][:2]] == [138,149]
    assert r68['new_retail_candidates_unverified'][0]['actual_all_in_with_china_vat_invoice_cny'] is None
    assert r68['new_retail_candidates_unverified'][1]['merchant_invoice_status'] == 'explicitly_not_committed_by_current_terms'
    assert r68['new_independent_phone_candidate']['merchant_displayed_price_cny_per_one_time_sms'] == 15
    assert r68['new_independent_phone_candidate']['refund_if_sms_not_received_original_payment_verified'] is False
    assert r68['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert by_id['gpt-source-followup-r67-20261106']['url'] == '../research/2026-11-06/supplier-followup-20261106-r12.html'
    assert by_id['gpt-source-followup-r67-20261106-evidence']['url'] == '../research/2026-11-06/supplier-followup-20261106-r12-evidence.json'
    r67 = json.loads((ROOT / 'dist/research/2026-11-06/supplier-followup-20261106-r12-evidence.json').read_bytes())
    assert r67['round'] == 67 and r67['site_version'] == '1.9.75' and len(r67['sources']) == 7
    assert r67['new_retail_plus_candidate_unverified']['displayed_price_cny_per_account_month'] == 168
    assert r67['new_retail_plus_candidate_unverified']['conditional_price_plus_five_percent_invoice_cny'] == 176.4
    assert r67['new_retail_plus_candidate_unverified']['plus_sku_invoice_eligibility_verified'] is False
    assert r67['new_retail_plus_candidate_unverified']['actual_total_payment_with_china_vat_invoice_cny'] is None
    assert r67['independent_phone_verification']['displayed_price_cny_per_number'] == 35
    assert r67['independent_phone_verification']['merchant_terms_allow_self_service_refund'] is False
    assert r67['partner_promotion_historical_claim']['promotion_current_checkout_price_verified'] is False
    assert r67['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert by_id['gpt-source-followup-r66-20261106']['url'] == '../research/2026-11-06/supplier-followup-20261106-r11.html'
    assert by_id['gpt-source-followup-r66-20261106-evidence']['url'] == '../research/2026-11-06/supplier-followup-20261106-r11-evidence.json'
    r66 = json.loads((ROOT / 'dist/research/2026-11-06/supplier-followup-20261106-r11-evidence.json').read_bytes())
    assert r66['round'] == 66 and r66['site_version'] == '1.9.74' and len([s for s in r66['sources'] if s['read_status'] == 'readable']) == 6
    assert r66['new_candidate']['advertised_price_usd_per_card'] == 16
    assert r66['new_candidate']['claimed_supreme_agent_price_usd_per_card'] == 16
    assert r66['new_candidate']['verified_invoice_including_payment_all_in_cny'] is None
    assert r66['new_candidate']['faq_admits_simulated_queue_count'] is True
    assert r66['new_candidate']['wholesale_qualified'] is False
    assert r66['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert by_id['gpt-source-followup-r65-20261106']['url'] == '../research/2026-11-06/supplier-followup-20261106-r10.html'
    assert by_id['gpt-source-followup-r65-20261106-evidence']['url'] == '../research/2026-11-06/supplier-followup-20261106-r10-evidence.json'
    r65 = json.loads((ROOT / 'dist/research/2026-11-06/supplier-followup-20261106-r10-evidence.json').read_bytes())
    assert r65['round'] == 65 and r65['site_version'] == '1.9.73' and len(r65['sources']) == 11
    assert r65['newly_observed_candidates']['chatgqt_direct_topup']['wholesale_agent_entry_fee_cny'] == 3000
    assert r65['newly_observed_candidates']['chatgqt_direct_topup']['agent_meets_no_upfront_fee'] is False
    assert r65['newly_observed_candidates']['getplus_ai']['invoice_surcharge_usd'] == 2.10
    assert r65['newly_observed_candidates']['getplus_ai']['enterprise_min_account_quantity'] == 5
    assert r65['newly_observed_candidates']['getplus_ai']['final_invoiced_cost_cny'] is None
    assert r65['newly_observed_candidates']['getplus_ai']['merchant_terms_do_not_accept_currently_in_mainland_china_orders'] is True
    assert r65['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert by_id['gpt-source-followup-r64-20261106']['url'] == '../research/2026-11-06/supplier-followup-20261106-r09.html'
    assert by_id['gpt-source-followup-r64-20261106-evidence']['url'] == '../research/2026-11-06/supplier-followup-20261106-r09-evidence.json'
    r64 = json.loads((ROOT / 'dist/research/2026-11-06/supplier-followup-20261106-r09-evidence.json').read_bytes())
    assert r64['round'] == 64 and r64['site_version'] == '1.9.72' and len(r64['sources']) == 12
    assert r64['newly_observed_retail_candidate']['product_page_default_price_cny'] == 79
    assert r64['newly_observed_retail_candidate']['product_page_default_is_own_existing_account'] is False
    r64_topups = r64['newly_observed_retail_candidate']['distinct_existing_account_skus']
    assert [(s['listed_price_cny_per_item'], s['merchant_says_existing_account_topup']) for s in r64_topups] == [(130, True), (155, True)]
    assert all(s['exact_validity_months_confirmed'] is None for s in r64_topups)
    assert r64['newly_observed_retail_candidate']['verified_invoiced_final_cost_cny'] is None
    assert r64['newly_observed_retail_candidate']['formal_resale_authorization_verified'] is False
    assert r64['newly_observed_retail_candidate']['privacy_page_complete_policy_published'] is False
    assert r64['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert by_id['gpt-source-followup-r63-20261106']['url'] == '../research/2026-11-06/supplier-followup-20261106-r08.html'
    assert by_id['gpt-source-followup-r63-20261106-evidence']['url'] == '../research/2026-11-06/supplier-followup-20261106-r08-evidence.json'
    r63 = json.loads((ROOT / 'dist/research/2026-11-06/supplier-followup-20261106-r08-evidence.json').read_bytes())
    assert r63['round'] == 63 and r63['site_version'] == '1.9.71' and len(r63['sources']) == 11
    assert r63['new_phone_verification_candidate']['short']['listed_price_cny_per_card'] == 10
    assert r63['new_phone_verification_candidate']['long']['listed_price_cny_per_card'] == 20
    assert r63['new_phone_verification_candidate']['long']['number_lifetime_days_min'] == 20
    assert r63['same_merchant_plus_offer']['listed_price_cny_per_30_days'] == 179
    assert r63['same_merchant_plus_offer']['all_required_invoiced_cny'] is None
    assert r63['getgpt_pro_codex_sms_recheck']['claim_independently_verified'] is False
    assert r63['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert by_id['gpt-source-followup-r62-20261106']['url'] == '../research/2026-11-06/supplier-followup-20261106-r07.html'
    assert by_id['gpt-source-followup-r62-20261106-evidence']['url'] == '../research/2026-11-06/supplier-followup-20261106-r07-evidence.json'
    r62 = json.loads((ROOT / 'dist/research/2026-11-06/supplier-followup-20261106-r07-evidence.json').read_bytes())
    assert r62['round'] == 62 and r62['site_version'] == '1.9.70' and len(r62['sources']) == 6
    c62 = r62['correction']
    assert c62['supersedes_r61_current_catalog_display_claim'] is True
    assert c62['catalog_price_cny_per_public_card']['ios_gift_card'] == 139
    assert c62['catalog_self_marked_update_date'] == '2026-11-05'
    assert c62['actual_checkout_price_cny'] is None and c62['verified_real_price_drop'] is False
    assert c62['verified_domestic_tax_invoice'] is False and c62['verified_wholesale_authorization'] is False
    assert r62['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert by_id['gpt-source-followup-r61-20261106']['url'] == '../research/2026-11-06/supplier-followup-20261106-r06.html'
    assert by_id['gpt-source-followup-r61-20261106-evidence']['url'] == '../research/2026-11-06/supplier-followup-20261106-r06-evidence.json'
    r61 = json.loads((ROOT / 'dist/research/2026-11-06/supplier-followup-20261106-r06-evidence.json').read_bytes())
    assert r61['round'] == 61 and r61['site_version'] == '1.9.69' and len(r61['sources']) == 11
    v61 = r61['material_new_finding']
    assert v61['homepage_current']['ios_gift_card_plus_card_price_cny'] == 139
    assert v61['catalog_current']['ios_gift_card_plus_card_cny'] == 150
    assert v61['actual_checkout_unit_price_cny'] is None and v61['real_price_reduction_proven'] is False
    assert v61['verified_china_vat_invoice'] is False and v61['formal_wholesale_authorization_verified'] is False
    assert r61['sources'][6]['read_status'] == 'blocked_by_waf'
    assert r61['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert by_id['gpt-source-followup-r60-20261106']['url'] == '../research/2026-11-06/supplier-followup-20261106-r05.html'
    assert by_id['gpt-source-followup-r60-20261106-evidence']['url'] == '../research/2026-11-06/supplier-followup-20261106-r05-evidence.json'
    r60 = json.loads((ROOT / 'dist/research/2026-11-06/supplier-followup-20261106-r05-evidence.json').read_bytes())
    assert r60['round'] == 60 and r60['site_version'] == '1.9.68' and len(r60['sources']) == 12
    assert r60['new_phone_verification_candidate']['listed_price_cny_per_one_codex_verification_cdk'] == 3
    assert r60['new_phone_verification_candidate']['chatgpt_account_password_may_be_required'] is True
    assert r60['new_phone_verification_candidate']['authenticator_mfa_code_may_be_required'] is True
    assert r60['new_phone_verification_candidate']['codex_desktop_phone_success_tested'] is False
    assert r60['new_retail_plus_candidate_unverified']['price_cny_per_piece_per_month'] == 107
    assert r60['new_retail_plus_candidate_unverified']['real_invoiced_all_in_cny'] is None
    assert r60['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
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
    assert by_id['gpt-source-followup-r57-20261106']['url'] == '../research/2026-11-06/supplier-followup-20261106-r02.html'
    assert by_id['gpt-source-followup-r57-20261106-evidence']['url'] == '../research/2026-11-06/supplier-followup-20261106-r02-evidence.json'
    r57 = json.loads((ROOT / 'dist/research/2026-11-06/supplier-followup-20261106-r02-evidence.json').read_bytes())
    assert r57['round'] == 57 and r57['site_version'] == '1.9.65'
    assert len(r57['sources']) == 6
    assert r57['new_retail_candidate_unverified']['real_all_in_cny'] is None
    assert r57['new_retail_candidate_unverified']['known_advertised_components_sum_cny'] == 153
    assert r57['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert by_id['gpt-source-followup-r59-20261106']['url'] == '../research/2026-11-06/supplier-followup-20261106-r04.html'
    assert by_id['gpt-source-followup-r59-20261106-evidence']['url'] == '../research/2026-11-06/supplier-followup-20261106-r04-evidence.json'
    r59 = json.loads((ROOT / 'dist/research/2026-11-06/supplier-followup-20261106-r04-evidence.json').read_bytes())
    assert r59['round'] == 59 and r59['site_version'] == '1.9.67' and len(r59['sources']) == 11
    assert r59['new_independent_phone_service']['listed_price_cny_per_one_time_code'] == 9.99
    assert r59['new_independent_phone_service']['refund_after_payment_supported_by_faq'] is False
    assert r59['new_independent_phone_service']['real_payment_total_cny'] is None
    assert r59['new_independent_phone_service']['codex_desktop_success_tested'] is False
    assert r59['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert by_id['gpt-source-followup-r58-20261106']['url'] == '../research/2026-11-06/supplier-followup-20261106-r03.html'
    assert by_id['gpt-source-followup-r58-20261106-evidence']['url'] == '../research/2026-11-06/supplier-followup-20261106-r03-evidence.json'
    r58 = json.loads((ROOT / 'dist/research/2026-11-06/supplier-followup-20261106-r03-evidence.json').read_bytes())
    assert r58['round'] == 58 and r58['site_version'] == '1.9.66' and len(r58['sources']) == 11
    assert r58['new_sms_service']['openai_exact_sku_current_price'] is None
    assert r58['new_sms_service']['company_registration_cross_checked'] is True
    assert r58['new_sms_service']['codex_desktop_phone_success_tested'] is False
    assert r58['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
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
    assert by_id['gpt-source-followup-r73-20261106']['url'] == '../research/2026-11-06/supplier-followup-20261106-r18.html'
    assert by_id['gpt-source-followup-r73-20261106-evidence']['url'] == '../research/2026-11-06/supplier-followup-20261106-r18-evidence.json'
    r73 = json.loads((ROOT / 'dist/research/2026-11-06/supplier-followup-20261106-r18-evidence.json').read_bytes())
    assert r73['round'] == 73 and r73['site_version'] == '1.9.81' and len(r73['sources']) == 8
    sku73 = r73['new_retail_candidate']
    assert sku73['sku_id'] == 'pid=23' and sku73['advertised_base_price_cny'] == 169
    assert sku73['advertised_invoice_inclusive_price_cny'] == 179 and sku73['advertised_invoice_price_over_ceiling_cny'] == 9
    assert sku73['exact_sku_subscription_months_explicitly_verified'] is None
    assert sku73['actual_order_total_invoiced_cny'] is None and sku73['real_china_vat_invoice_verified'] is False
    assert sku73['fully_qualified_upstream'] is False
    assert r73['new_supply_chain_observation']['merchant_says_non_firsthand_suppliers_may_cooperate'] is True
    assert r73['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert by_id['gpt-source-followup-r74-20261106']['url'] == '../research/2026-11-06/supplier-followup-20261106-r19.html'
    assert by_id['gpt-source-followup-r74-20261106-evidence']['url'] == '../research/2026-11-06/supplier-followup-20261106-r19-evidence.json'
    r74 = json.loads((ROOT / 'dist/research/2026-11-06/supplier-followup-20261106-r19-evidence.json').read_bytes())
    assert r74['round'] == 74 and r74['site_version'] == '1.9.82' and len(r74['sources']) == 7
    assert r74['material_change']['historical_visible_availability'] == '暂时缺货'
    assert r74['material_change']['new_visible_availability'] == '现货 · 自动发货'
    assert r74['material_change']['advertised_price_changed'] is False
    assert r74['material_change']['actual_invoiced_total_cny'] is None
    assert r74['new_retail_wholesale_advertising_candidate']['merchant_promoted_agent_entry_fee_cny'] == 99
    assert r74['new_retail_wholesale_advertising_candidate']['merchant_explicitly_declines_mainland_china_users'] is True
    assert r74['new_retail_wholesale_advertising_candidate']['wholesale_qualified'] is False
    assert r74['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert by_id['gpt-source-followup-r75-20261106']['url'] == '../research/2026-11-06/supplier-followup-20261106-r20.html'
    assert by_id['gpt-source-followup-r75-20261106-evidence']['url'] == '../research/2026-11-06/supplier-followup-20261106-r20-evidence.json'
    r75 = json.loads((ROOT / 'dist/research/2026-11-06/supplier-followup-20261106-r20-evidence.json').read_bytes())
    assert r75['round'] == 75 and r75['site_version'] == '1.9.83' and len(r75['sources']) == 7
    assert r75['material_price_observation']['previous_recorded_price_cny'] == 115
    assert r75['material_price_observation']['current_public_price_cny'] == 113
    assert r75['material_price_observation']['all_required_invoiced_cny'] is None
    assert r75['independent_phone_verification']['public_price_cny'] == 3
    assert r75['independent_phone_verification']['real_openai_verification_passed'] is False
    assert r75['qualification_totals']['verified_plus_wholesale_upstreams'] == 0

    assert by_id['gpt-source-followup-r76-20261106']['url'] == '../research/2026-11-06/supplier-followup-20261106-r21.html'
    assert by_id['gpt-source-followup-r76-20261106-evidence']['url'] == '../research/2026-11-06/supplier-followup-20261106-r21-evidence.json'
    r76 = json.loads((ROOT / 'dist/research/2026-11-06/supplier-followup-20261106-r21-evidence.json').read_bytes())
    assert r76['round'] == 76 and r76['site_version'] == '1.9.84' and len(r76['sources']) == 8
    assert r76['new_retail_candidate']['public_base_price_cny_per_account_month'] == 143
    assert r76['new_retail_candidate']['public_china_vat_invoice_surcharge_cny'] == 10
    assert r76['new_retail_candidate']['conditional_displayed_components_total_cny'] == 153
    assert r76['new_retail_candidate']['verified_actual_checkout_total_with_valid_china_vat_invoice_cny'] is None
    assert r76['new_retail_candidate']['merchant_acknowledges_access_token_and_session_token'] is True
    assert r76['new_retail_candidate']['wholesale_qualified'] is False
    assert r76['qualification_totals']['verified_plus_wholesale_upstreams'] == 0

    assert by_id['gpt-source-followup-r77-20261107']['url'] == '../research/2026-11-07/supplier-followup-20261107.html'
    assert by_id['gpt-source-followup-r77-20261107-evidence']['url'] == '../research/2026-11-07/supplier-followup-20261107-evidence.json'
    r77 = json.loads((ROOT / 'dist/research/2026-11-07/supplier-followup-20261107-evidence.json').read_bytes())
    assert r77['round'] == 77 and r77['site_version'] == '1.9.85' and len(r77['sources']) == 10
    assert r77['new_retail_lead_unverified']['public_displayed_price_cny_per_30_day_card'] == 125
    assert r77['new_retail_lead_unverified']['merchant_admits_third_party_distributor_order_and_fulfillment'] is True
    assert r77['new_retail_lead_unverified']['actual_one_unit_total_cny_with_valid_china_vat_invoice'] is None
    assert r77['new_retail_lead_unverified']['wholesale_qualified'] is False
    assert r77['independent_phone_verification']['conflicting_price_display'] is True
    assert r77['independent_phone_verification']['actual_checkout_price_cny'] is None
    assert r77['qualification_totals']['verified_plus_wholesale_upstreams'] == 0

    assert by_id['gpt-source-followup-r78-20261107']['url'] == '../research/2026-11-07/supplier-followup-20261107-r2.html'
    assert by_id['gpt-source-followup-r78-20261107-evidence']['url'] == '../research/2026-11-07/supplier-followup-20261107-r2-evidence.json'
    r78 = json.loads((ROOT / 'dist/research/2026-11-07/supplier-followup-20261107-r2-evidence.json').read_bytes())
    assert r78['round'] == 78 and r78['site_version'] == '1.9.86' and len(r78['sources']) == 4
    assert r78['material_policy_scope_discovery']['explicit_warranty_only_for_marked_items'] is True
    assert all(item['warranty_mark_on_current_catalog'] is False for item in r78['material_policy_scope_discovery']['original_account_skus'])
    assert r78['material_policy_scope_discovery']['merchant_site_public_claims_conflict'] is True
    assert r78['material_policy_scope_discovery']['warranty_entitlement_of_specific_paid_order_verified'] is None
    assert r78['qualification_totals']['verified_plus_wholesale_upstreams'] == 0

    assert by_id['gpt-source-followup-r79-20261107']['url'] == '../research/2026-11-07/supplier-followup-20261107-r3.html'
    assert by_id['gpt-source-followup-r79-20261107-evidence']['url'] == '../research/2026-11-07/supplier-followup-20261107-r3-evidence.json'
    r79 = json.loads((ROOT / 'dist/research/2026-11-07/supplier-followup-20261107-r3-evidence.json').read_bytes())
    assert r79['round'] == 79 and r79['site_version'] == '1.9.87' and len(r79['sources']) == 12
    assert r79['material_phone_risk']['historical_event_from'] == '2026-07-27'
    assert r79['material_phone_risk']['operator_terms_newly_changed_on_observation_date'] is False
    assert r79['material_phone_risk']['carrier_community_19_days_case_full_page_read'] is False
    assert r79['material_phone_risk']['phone_number_validity_guarantee_days'] is None
    assert r79['qualification_totals']['verified_plus_wholesale_upstreams'] == 0

    assert by_id['gpt-source-followup-r80-20261107']['url'] == '../research/2026-11-07/supplier-followup-20261107-r4.html'
    assert by_id['gpt-source-followup-r80-20261107-evidence']['url'] == '../research/2026-11-07/supplier-followup-20261107-r4-evidence.json'
    r80 = json.loads((ROOT / 'dist/research/2026-11-07/supplier-followup-20261107-r4-evidence.json').read_bytes())
    assert r80['round'] == 80 and r80['site_version'] == '1.9.88' and len(r80['sources']) == 11
    assert r80['new_candidate']['public_list_price_cny_per_account_month'] == 129
    assert r80['new_candidate']['company_vat_invoice_issuer_name'] is None
    assert r80['new_candidate']['final_payable_all_in_china_vat_invoice_cny'] is None
    assert r80['new_candidate']['merchant_claimed_personal_operator'] is True
    assert r80['new_candidate']['invoice_can_be_requested_merchant_claim'] is True
    assert r80['new_candidate']['wholesale_qualified'] is False
    assert r80['independent_phone_verification']['ordinary_plus_purchase_automatically_binds_phone'] is False
    assert r80['qualification_totals']['verified_plus_wholesale_upstreams'] == 0


    assert by_id['gpt-source-followup-r81-20261107']['url'] == '../research/2026-11-07/supplier-followup-20261107-r5.html'
    assert by_id['gpt-source-followup-r81-20261107-evidence']['url'] == '../research/2026-11-07/supplier-followup-20261107-r5-evidence.json'
    r81 = json.loads((ROOT / 'dist/research/2026-11-07/supplier-followup-20261107-r5-evidence.json').read_bytes())
    assert r81['round'] == 81 and r81['site_version'] == '1.9.89' and len(r81['sources']) == 15
    assert r81['discoveries'][0]['merchant_claim_invoiced_unused_prepay_principally_nonrefundable_with_law_and_agreement_exceptions'] is True
    assert r81['discoveries'][0]['public_price_cny_per_account_month'] is None
    assert r81['discoveries'][1]['merchant_displayed_price_cny_per_month'] == 158
    assert r81['discoveries'][1]['actual_all_required_invoiced_cny'] is None
    assert r81['discoveries'][2]['merchant_explicitly_excludes_physically_mainland_china_customer_orders'] is True
    assert r81['discoveries'][2]['actual_all_required_china_vat_invoice_cny'] is None
    assert r81['qualification_totals']['verified_plus_wholesale_upstreams'] == 0

    assert by_id['gpt-source-followup-r82-20261107']['url'] == '../research/2026-11-07/supplier-followup-20261107-r6.html'
    assert by_id['gpt-source-followup-r82-20261107-evidence']['url'] == '../research/2026-11-07/supplier-followup-20261107-r6-evidence.json'
    r82 = json.loads((ROOT / 'dist/research/2026-11-07/supplier-followup-20261107-r6-evidence.json').read_bytes())
    assert r82['round'] == 82 and r82['site_version'] == '1.9.90' and len(r82['sources']) == 4
    assert r82['material_discovery']['merchant_public_online_price_cny'] == 139.99
    assert r82['material_discovery']['merchant_public_online_invoice_fee_cny_per_unit'] == 10
    assert r82['material_discovery']['online_component_sum_cny'] == 149.99
    assert r82['material_discovery']['merchant_public_corporate_school_bank_transfer_price_cny'] == 160
    assert r82['material_discovery']['corporate_price_includes_einvoice'] is None
    assert r82['material_discovery']['actual_paid_invoice_total_cny'] is None
    assert r82['material_discovery']['guest_checkout_invoice_eligibility_verified'] is False
    assert r82['qualification_totals']['verified_plus_wholesale_upstreams'] == 0

    assert by_id['gpt-source-followup-r83-20261107']['url'] == '../research/2026-11-07/supplier-followup-20261107-r7.html'
    assert by_id['gpt-source-followup-r83-20261107-evidence']['url'] == '../research/2026-11-07/supplier-followup-20261107-r7-evidence.json'
    r83 = json.loads((ROOT / 'dist/research/2026-11-07/supplier-followup-20261107-r7-evidence.json').read_bytes())
    assert r83['round'] == 83 and r83['site_version'] == '1.9.91' and len(r83['sources']) == 5
    assert r83['material_discoveries'][0]['previous_stock_label'] == '无货'
    assert r83['material_discoveries'][0]['current_stock_label'] == '一般'
    assert r83['material_discoveries'][0]['previous_list_price_cny'] == 143.5
    assert r83['material_discoveries'][0]['current_list_price_cny'] == 143.5
    assert r83['material_discoveries'][0]['same_original_account_preserved_after_failure_guaranteed'] is False
    assert r83['material_discoveries'][1]['current_stock_label'] == '暂时缺货'
    assert r83['material_discoveries'][1]['actual_stock_status_change_proven'] is False
    assert r83['qualification_totals']['verified_plus_wholesale_upstreams'] == 0

    assert by_id['gpt-source-followup-r88-20261107']['url'] == '../research/2026-11-07/supplier-followup-20261107-r12.html'
    assert by_id['gpt-source-followup-r88-20261107-evidence']['url'] == '../research/2026-11-07/supplier-followup-20261107-r12-evidence.json'
    r88 = json.loads((ROOT / 'dist/research/2026-11-07/supplier-followup-20261107-r12-evidence.json').read_bytes())
    assert r88['round'] == 88 and r88['site_version'] == '1.9.96' and len(r88['sources']) == 8
    assert r88['material_new_candidate']['displayed_retail_skus'][0]['public_list_price_cny'] == 128
    assert r88['material_new_candidate']['displayed_retail_skus'][1]['public_list_price_cny'] == 148
    assert r88['material_new_candidate']['enterprise_supply']['merchant_claim_minimum_account_count'] == 5
    assert r88['material_new_candidate']['enterprise_supply']['claimed_technical_service_fee_percent_for_enterprise_special_invoice'] == 6
    assert r88['material_new_candidate']['enterprise_supply']['one_item_real_vat_invoice_total_cny'] is None
    assert r88['independent_phone_verification']['verified_independent_service'] is False
    assert r88['qualification_totals']['verified_plus_wholesale_upstreams'] == 0

    assert by_id['gpt-source-followup-r87-20261107']['url'] == '../research/2026-11-07/supplier-followup-20261107-r11.html'
    assert by_id['gpt-source-followup-r87-20261107-evidence']['url'] == '../research/2026-11-07/supplier-followup-20261107-r11-evidence.json'
    r87 = json.loads((ROOT / 'dist/research/2026-11-07/supplier-followup-20261107-r11-evidence.json').read_bytes())
    assert r87['round'] == 87 and r87['site_version'] == '1.9.95' and len(r87['sources']) == 13
    assert r87['substantive_aftersales_clarification']['mass_incident_refund_unconditionally_guaranteed'] is False
    assert r87['substantive_aftersales_clarification']['real_all_in_vat_invoice_total_cny'] is None
    assert r87['independent_codex_verification']['unable_to_receive_sms_refund_cny'] is None
    assert r87['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert by_id['gpt-source-followup-r86-20261107']['url'] == '../research/2026-11-07/supplier-followup-20261107-r10.html'
    assert by_id['gpt-source-followup-r86-20261107-evidence']['url'] == '../research/2026-11-07/supplier-followup-20261107-r10-evidence.json'
    r86 = json.loads((ROOT / 'dist/research/2026-11-07/supplier-followup-20261107-r10-evidence.json').read_bytes())
    assert r86['round'] == 86 and r86['site_version'] == '1.9.94' and len(r86['sources']) == 7
    assert r86['material_correction']['current_invoice_portal_accepting_applications'] is False
    assert r86['material_correction']['invoice_member_login_required_before_purchase'] is True
    assert r86['material_correction']['guest_order_invoice_access_claim'] is False
    assert r86['material_correction']['known_component_sum_cny'] == 149.99
    assert r86['material_correction']['actual_total_including_any_other_payment_and_valid_china_vat_invoice_cny'] is None
    assert r86['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert by_id['gpt-source-followup-r85-20261107']['url'] == '../research/2026-11-07/supplier-followup-20261107-r9.html'
    assert by_id['gpt-source-followup-r85-20261107-evidence']['url'] == '../research/2026-11-07/supplier-followup-20261107-r9-evidence.json'
    r85 = json.loads((ROOT / 'dist/research/2026-11-07/supplier-followup-20261107-r9-evidence.json').read_bytes())
    assert r85['round'] == 85 and r85['site_version'] == '1.9.93' and len(r85['sources']) == 7
    assert r85['new_candidates'][0]['listed_price'] == 16
    assert r85['new_candidates'][0]['currency'] == 'USD'
    assert r85['new_candidates'][0]['actual_agent_discount_usd_from_displayed_retail'] == 0
    assert r85['new_candidates'][0]['actual_all_in_china_vat_invoice_cny'] is None
    assert r85['new_candidates'][1]['displayed_preorder_total_cny'] == 149.78
    assert r85['new_candidates'][1]['wholesale_unit_cost_cny'] is None
    assert r85['new_candidates'][1]['tiers'][3]['commission_percent'] == 25
    assert r85['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert by_id['gpt-source-followup-r84-20261107']['url'] == '../research/2026-11-07/supplier-followup-20261107-r8.html'
    assert by_id['gpt-source-followup-r84-20261107-evidence']['url'] == '../research/2026-11-07/supplier-followup-20261107-r8-evidence.json'
    r84 = json.loads((ROOT / 'dist/research/2026-11-07/supplier-followup-20261107-r8-evidence.json').read_bytes())
    assert r84['round'] == 84 and r84['site_version'] == '1.9.92' and len(r84['sources']) == 5
    assert r84['new_candidates'][0]['options'][0]['price_cny'] == 119
    assert r84['new_candidates'][0]['options'][2]['price_cny'] == 130
    assert r84['new_candidates'][0]['checkout_warns_preorder_ship_after_restock'] is True
    assert r84['new_candidates'][0]['actual_all_in_china_vat_invoice_cny'] is None
    assert r84['new_candidates'][1]['requires_logged_in_session_json'] is True
    assert r84['new_candidates'][1]['actual_all_in_china_vat_invoice_cny'] is None
    assert r84['phone_verification']['plus6_price_cny'] is None
    assert r84['qualification_totals']['verified_plus_wholesale_upstreams'] == 0

    assert by_id['gpt-source-followup-r90-20261108']['url'] == '../research/2026-11-08/supplier-followup-20261108-r2.html'
    assert by_id['gpt-source-followup-r90-20261108-evidence']['url'] == '../research/2026-11-08/supplier-followup-20261108-r2-evidence.json'
    r90 = json.loads((ROOT / 'dist/research/2026-11-08/supplier-followup-20261108-r2-evidence.json').read_bytes())
    assert r90['round'] == 90 and r90['site_version'] == '1.9.98' and len(r90['sources']) == 8
    assert r90['newly_documented_public_api']['customer_supplies_payment_card'] is True
    assert r90['newly_documented_public_api']['public_example_plus_price_credits'] == 50
    assert r90['newly_documented_public_api']['real_live_plus_price_credits'] is None
    assert r90['newly_documented_public_api']['real_all_in_china_vat_invoice_total_cny'] is None
    assert r90['newly_documented_public_api']['eligible_verified_plus_upstream'] is False
    assert r90['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert by_id['gpt-source-followup-r91-20261108']['url'] == '../research/2026-11-08/supplier-followup-20261108-r3.html'
    assert by_id['gpt-source-followup-r91-20261108-evidence']['url'] == '../research/2026-11-08/supplier-followup-20261108-r3-evidence.json'
    r91 = json.loads((ROOT / 'dist/research/2026-11-08/supplier-followup-20261108-r3-evidence.json').read_bytes())
    assert r91['round'] == 91 and r91['site_version'] == '1.9.99' and len(r91['sources']) == 8
    assert r91['new_retail_intermediary']['merchant_terms_prohibit_bulk_resale'] is True
    assert r91['new_retail_intermediary']['exact_public_skus'][0]['public_list_price_cny_per_package'] == 145
    assert r91['new_retail_intermediary']['exact_public_skus'][1]['public_list_price_cny_per_package'] == 165
    assert r91['new_retail_intermediary']['exact_public_skus'][0]['actual_subscription_term_days'] is None
    assert r91['new_retail_intermediary']['exact_public_skus'][1]['actual_china_vat_invoice_all_in_cny'] is None
    assert r91['excluded_example']['real_plus_subscription_sku_verified'] is False
    assert r91['qualification_totals']['verified_plus_wholesale_upstreams'] == 0

    assert by_id['gpt-source-followup-r92-20261108']['url'] == '../research/2026-11-08/supplier-followup-20261108-r4.html'
    assert by_id['gpt-source-followup-r92-20261108-evidence']['url'] == '../research/2026-11-08/supplier-followup-20261108-r4-evidence.json'
    r92 = json.loads((ROOT / 'dist/research/2026-11-08/supplier-followup-20261108-r4-evidence.json').read_bytes())
    assert r92['round'] == 92 and r92['site_version'] == '1.9.100' and len(r92['sources']) == 5
    assert r92['newly_documented_agent_program']['program_public_upfront_service_price_cny'] == 88
    assert r92['newly_documented_agent_program']['program_is_upfront_fee_free'] is False
    assert r92['newly_documented_agent_program']['merchant_general_terms_prohibit_resale'] is True
    assert r92['newly_documented_agent_program']['program_public_wholesale_plus_price_cny'] is None
    assert [s['public_price_cny_per_account_month'] for s in r92['bounded_recheck_of_existing_retail_skus']] == [135,145]
    assert all(s['actual_all_required_payment_and_china_vat_invoice_cny'] is None for s in r92['bounded_recheck_of_existing_retail_skus'])
    assert r92['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    from validate_current_updates import validate_current_updates
    validate_current_updates()
    from validate_task35 import validate_task35, negative_tests
    validate_task35(); negative_tests()
    assert by_id['gpt-source-followup-r93-20261108']['url'] == '../research/2026-11-08/supplier-followup-20261108-r5.html'
    assert by_id['gpt-source-followup-r93-20261108-evidence']['url'] == '../research/2026-11-08/supplier-followup-20261108-r5-evidence.json'
    r93 = json.loads((ROOT / 'dist/research/2026-11-08/supplier-followup-20261108-r5-evidence.json').read_bytes())
    assert r93['round'] == 93 and r93['site_version'] == '1.9.101' and len(r93['sources']) == 4
    assert r93['new_business_supplier_candidate']['public_volume_discount_threshold_seats'] == 10
    assert r93['new_business_supplier_candidate']['public_strict_minimum_order_seats'] is None
    assert r93['new_business_supplier_candidate']['public_bulk_unit_price_usd'] is None
    assert r93['new_business_supplier_candidate']['china_vat_invoice_available'] is False
    assert r93['new_business_supplier_candidate']['api_credit_refund_is_cash_refund'] is False
    assert r93['new_business_supplier_candidate']['b2b_retail_resale_authorization_document'] is None
    assert r93['separate_public_retail_sku']['public_display_price_number'] == 23.9
    assert r93['separate_public_retail_sku']['actual_all_required_fees_and_valid_china_vat_invoice_cny'] is None
    assert r93['phone_verification']['verified_sms_successes'] == 0
    assert r93['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert by_id['gpt-source-followup-r94-20261108']['url'] == '../research/2026-11-08/supplier-followup-20261108-r6.html'
    assert by_id['gpt-source-followup-r94-20261108-evidence']['url'] == '../research/2026-11-08/supplier-followup-20261108-r6-evidence.json'
    r94 = json.loads((ROOT / 'dist/research/2026-11-08/supplier-followup-20261108-r6-evidence.json').read_bytes())
    assert r94['round'] == 94 and r94['site_version'] == '1.9.102' and len(r94['sources']) == 6
    assert [v['public_price_cny'] for v in r94['conflicting_current_retail_sku']['current_observations']] == [169,159,159]
    assert r94['conflicting_current_retail_sku']['historical_direct_observation']['observed_on'] == '2026-11-06'
    assert r94['conflicting_current_retail_sku']['verified_single_payable_retail_price_cny'] is None
    assert r94['conflicting_current_retail_sku']['all_required_fees_including_valid_china_vat_invoice_cny'] is None
    assert r94['wholesale_and_invoice_bounded_recheck']['real_one_item_wholesale_price_cny'] is None
    assert r94['phone_verification']['successful_sms_tests'] == 0
    assert r94['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert by_id['gpt-source-followup-r95-20261108']['url'] == '../research/2026-11-08/supplier-followup-20261108-r7.html'
    assert by_id['gpt-source-followup-r95-20261108-evidence']['url'] == '../research/2026-11-08/supplier-followup-20261108-r7-evidence.json'
    r95 = json.loads((ROOT / 'dist/research/2026-11-08/supplier-followup-20261108-r7-evidence.json').read_bytes())
    assert r95['round'] == 95 and r95['site_version'] == '1.9.103' and len(r95['sources']) == 12
    assert r95['opengptplus']['merchant_agent_inventory_min_cards'] == 10
    assert r95['opengptplus']['merchant_api_deposit_cny_min'] == 3000
    assert r95['opengptplus']['homepage_now_no_listed_products'] is True
    assert r95['gpt100x']['public_plus_cny_per_account_30days'] == 138
    assert r95['gpt100x']['verified_one_item_plus_vat_invoice'] is False
    assert r95['gpt100x']['actual_all_required_plus_vat_checkout_cny'] is None
    assert r95['phone_verification']['successful_sms_tests'] == 0
    assert r95['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert by_id['gpt-source-followup-r113-20261109']['url'] == '../research/2026-11-09/supplier-followup-20261109-r7.html'
    assert by_id['gpt-source-followup-r113-20261109-evidence']['url'] == '../research/2026-11-09/supplier-followup-20261109-r7-evidence.json'
    r113 = json.loads((ROOT / 'dist/research/2026-11-09/supplier-followup-20261109-r7-evidence.json').read_bytes())
    assert r113['round'] == 113 and r113['site_version'] == '1.9.121' and len(r113['sources']) == 4
    assert r113['new_candidate']['merchant_claim_platform_checkout_no_invoice'] is True
    assert r113['new_candidate']['merchant_claim_enterprise_procurement_invoice_separately_quoted'] is True
    assert r113['new_candidate']['plus_first_party_price_cny_per_account_month'] is None
    assert r113['new_candidate']['all_required_fees_including_vat_cny'] is None
    assert r113['new_candidate']['qualified_plus_wholesale_source'] is False
    assert r113['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert by_id['gpt-source-followup-r114-20261110']['url'] == '../research/2026-11-10/supplier-followup-20261110.html'
    assert by_id['gpt-source-followup-r114-20261110-evidence']['url'] == '../research/2026-11-10/supplier-followup-20261110-evidence.json'
    r114 = json.loads((ROOT/'dist/research/2026-11-10/supplier-followup-20261110-evidence.json').read_bytes())
    assert r114['round']==114 and r114['site_version']=='1.9.122' and len(r114['sources'])==5
    assert r114['new_candidate']['public_plus_1_to_4_seats_monthly_cny_per_seat']==165
    assert r114['new_candidate']['masked_invoice_demo_contains_placeholders'] is True
    assert r114['new_candidate']['all_required_fees_and_real_valid_china_vat_total_cny'] is None
    assert r114['new_candidate']['documented_lawful_resale_authorization'] is None
    assert r114['qualification_totals']['verified_plus_wholesale_upstreams']==0
    assert by_id['gpt-source-followup-r139-20261111']['url'] == '../research/2026-11-11/supplier-followup-20261111-r12.html'
    assert by_id['gpt-source-followup-r139-20261111-evidence']['url'] == '../research/2026-11-11/supplier-followup-20261111-r12-evidence.json'
    r139 = json.loads((ROOT / 'dist/research/2026-11-11/supplier-followup-20261111-r12-evidence.json').read_bytes())
    assert r139['round'] == 139 and r139['site_version'] == '1.9.147' and len(r139['sources']) == 4
    assert r139['new_evidence']['independent_sms_5sim']['merchant_reported_best_sms_receipt_pct'] == 46
    assert r139['new_evidence']['independent_sms_5sim']['merchant_claim_refund_is_cash_original_payment'] is False
    assert r139['official_openai_reference']['voip_numbers_not_supported'] is True
    assert r139['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert r139['qualification_totals']['verified_phone_sms_successes'] == 0
    # R144: vendor's Pro display price is not store checkout or verified official entitlement.
    assert by_id['gpt-source-followup-r144-20261111']['url'] == '../research/2026-11-11/supplier-followup-20261111-r17.html'
    assert by_id['gpt-source-followup-r144-20261111-evidence']['url'] == '../research/2026-11-11/supplier-followup-20261111-r17-evidence.json'
    r144 = json.loads((ROOT/'dist/research/2026-11-11/supplier-followup-20261111-r17-evidence.json').read_bytes())
    assert r144['round'] == 144 and r144['site_version'] == '1.9.152'
    assert [p['display_price_cny'] for p in r144['new_evidence']['chongpay']['pro_products']] == [1188,3299]
    assert r144['new_evidence']['chongpay']['external_shop_readable'] is False
    assert r144['new_evidence']['chongpay']['all_fees_plus_including_valid_vat_cny'] is None
    assert r144['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    # R145: first-party account restrictions and the official receipt channel are not transaction evidence.
    assert by_id['gpt-source-followup-r145-20261111']['url'] == '../research/2026-11-11/supplier-followup-20261111-r18.html'
    assert by_id['gpt-source-followup-r145-20261111-evidence']['url'] == '../research/2026-11-11/supplier-followup-20261111-r18-evidence.json'
    r145 = json.loads((ROOT/'dist/research/2026-11-11/supplier-followup-20261111-r18-evidence.json').read_bytes())
    assert r145['round'] == 145 and r145['site_version'] == '1.9.153'
    assert r145['new_evidence']['chongpay_account_eligibility']['joined_team_disallowed'] is True
    assert r145['new_evidence']['chongpay_account_eligibility']['payment_fee_cny'] is None
    assert r145['new_evidence']['official_subscription_receipt_provenance']['apple_google_store_purchase_invoice_appears_in_chatgpt_web_billing'] is False
    assert r145['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    # R146: API-only three-account phone verification cap is not a general Codex or phone-only signup limit.
    assert by_id['gpt-source-followup-r146-20261111']['url'] == '../research/2026-11-11/supplier-followup-20261111-r19.html'
    assert by_id['gpt-source-followup-r146-20261111-evidence']['url'] == '../research/2026-11-11/supplier-followup-20261111-r19-evidence.json'
    r146 = json.loads((ROOT/'dist/research/2026-11-11/supplier-followup-20261111-r19-evidence.json').read_bytes())
    assert r146['round'] == 146 and r146['site_version'] == '1.9.154'
    assert r146['new_evidence']['official_first_api_key_phone_reuse']['maximum_distinct_accounts_for_initial_api_key_phone_verification'] == 3
    assert r146['new_evidence']['official_first_api_key_phone_reuse']['limit_reset_by_chatgpt_account_deletion'] is False
    assert r146['new_evidence']['official_first_api_key_phone_reuse']['applies_to_all_codex_phone_challenges'] is False
    assert r146['new_evidence']['official_phone_change']['existing_associated_phone_update_supported'] is False
    assert r146['new_evidence']['official_phone_only_signup_distinction']['phone_only_signup_separate_from_initial_api_key_verification'] is True
    assert all(value is None for value in r146['unknown_merchant_costs'].values())
    assert all(value == 0 for value in r146['qualification_totals'].values())
    assert all(fail['prior_price_unchanged'] for fail in r146['access_failures_not_price_observations'])
    # R147: Pro API grant is subject to claim/ownership, not a Codex API Key or seller-verified grant.
    assert by_id['gpt-source-followup-r147-20261111']['url'] == '../research/2026-11-11/supplier-followup-20261111-r20.html'
    assert by_id['gpt-source-followup-r147-20261111-evidence']['url'] == '../research/2026-11-11/supplier-followup-20261111-r20-evidence.json'
    r147 = json.loads((ROOT/'dist/research/2026-11-11/supplier-followup-20261111-r20-evidence.json').read_bytes())
    assert r147['round'] == 147 and r147['site_version'] == '1.9.155'
    assert len(r147['sources']) == 2
    benefit = r147['new_evidence']['official_chatgpt_subscription_api_credit_benefit']
    assert benefit['required_paid_active_days_before_claim'] == 7
    assert benefit['codex_via_api_key_covered'] is False
    assert benefit['chatgpt_plus_ineligible'] is True
    assert benefit['grant_automatically_issued_on_purchase'] is False
    assert r147['new_evidence']['getgpt_pro_current_catalog_claim']['all_required_fees_cny'] is None
    assert all(v == 0 for v in r147['qualification_totals'].values())
    # R148: merchant eligibility and redirect links do not establish official restrictions or wholesale.
    assert by_id['gpt-source-followup-r148-20261112']['url'].endswith('supplier-followup-20261112.html')
    assert by_id['gpt-source-followup-r148-20261112-evidence']['url'].endswith('supplier-followup-20261112-evidence.json')
    r148 = json.loads((ROOT/'dist/research/2026-11-12/supplier-followup-20261112-evidence.json').read_bytes())
    x148 = r148['new_evidence']['xiaojiu_account_prerequisites']
    assert r148['round'] == 148 and r148['site_version'] == '1.9.156'
    assert len(r148['sources']) == 8 and len(r148['access_failures_not_price_observations']) == 7
    assert x148['no_prior_zero_amount_recharge_required'] is True and x148['price_change_proven'] is False
    assert x148['ios_google_after_expiry_wait_days_claimed'] == [2,3]
    assert x148['turkey_regular_ios_after_expiry_wait_days_claimed'] == [4,5]
    assert x148['catfk_payment_link_proves_wholesale_relationship'] is False
    assert x148['all_in_plus_with_china_vat_cny'] is None
    assert all(value is None for value in r148['unknown_merchant_costs'].values())
    assert all(value == 0 for value in r148['qualification_totals'].values())
    # R151: live and indexed same-SKU snapshots conflict; do not upgrade retail listings to settled wholesale.
    assert by_id['gpt-source-followup-r151-20261112']['url'] == '../research/2026-11-12/supplier-followup-20261112-r4.html'
    assert by_id['gpt-source-followup-r151-20261112-evidence']['url'] == '../research/2026-11-12/supplier-followup-20261112-r4-evidence.json'
    r151 = json.loads((ROOT/'dist/research/2026-11-12/supplier-followup-20261112-r4-evidence.json').read_bytes())
    assert r151['round'] == 151 and r151['site_version'] == '1.9.159' and len(r151['sources']) == 8
    y151 = r151['new_evidence']['yinlujing_same_url_listing_comparison']
    assert y151['prior_guaranteed_plus_listing_cny'] == 135 and y151['live_guaranteed_plus_listing_cny'] == 145
    assert y151['conflicting_indexed_snapshot_guaranteed_cny'] == 135 and y151['confirmed_price_change_date'] is None
    assert y151['actual_verified_all_in_cny'] is None and y151['illustrative_total_is_paid_or_tax_verified'] is False
    m151 = r151['new_evidence']['morimm_exact_product_comparison']
    assert (m151['prior_listing_cny'],m151['live_listing_cny']) == (113,114)
    assert m151['actual_member_price_and_checkout_cny'] is None
    assert r151['new_evidence']['catfk_merchant_structure_note']['wholesale_authorization_verified'] is False
    assert all(v is None for v in r151['unknown_costs'].values())
    assert all(v == 0 for v in r151['qualification_totals'].values())
    assert r151['purchase_or_login_attempted'] is False and r151['merchant_contacted'] is False
    # R152: independent CatFK seller, same public redemption endpoint, still not a verified wholesale source.
    assert by_id['gpt-source-followup-r152-20261112']['url'] == '../research/2026-11-12/supplier-followup-20261112-r5.html'
    assert by_id['gpt-source-followup-r152-20261112-evidence']['url'] == '../research/2026-11-12/supplier-followup-20261112-r5-evidence.json'
    r152 = json.loads((ROOT/'dist/research/2026-11-12/supplier-followup-20261112-r5-evidence.json').read_bytes())
    assert r152['round'] == 152 and r152['site_version'] == '1.9.160' and len(r152['sources']) == 4
    x152 = r152['new_evidence']['catfk_xiaoai_independent_seller']
    assert x152['displayed_retail_price_cny'] == 168 and x152['verified_all_in_cny'] is None
    assert x152['seller_claim_refund_deduction_percent'] == 20 and x152['actual_refund_tested'] is False
    assert x152['verified_formal_resale_authorization'] is False and x152['upstream_qualified'] is False
    term152 = r152['new_evidence']['shared_redemption_terminal']
    assert term152['http_status'] == 200 and term152['common_link_proves_same_company_or_verified_wholesale_upstream'] is False
    assert r152['new_evidence']['yinlujing_current_disclaimer']['formal_resale_authorization_document_verified'] is False
    assert all(value is None for value in r152['unknown_costs'].values())
    assert all(value == 0 for value in r152['qualification_totals'].values())
    assert r152['purchase_or_login_attempted'] is False and r152['merchant_contacted'] is False
    # R153: direct seller Codex card price comparison and unaudited session-dependent redemption.
    assert by_id['gpt-source-followup-r153-20261112']['url'] == '../research/2026-11-12/supplier-followup-20261112-r6.html'
    assert by_id['gpt-source-followup-r153-20261112-evidence']['url'] == '../research/2026-11-12/supplier-followup-20261112-r6-evidence.json'
    r153 = json.loads((ROOT/'dist/research/2026-11-12/supplier-followup-20261112-r6-evidence.json').read_bytes())
    assert r153['round'] == 153 and r153['site_version'] == '1.9.161'
    assert len(r153['sources']) == 4
    assert r153['new_evidence']['morimm_codex_once']['historical_price_cny'] == 3
    assert r153['new_evidence']['morimm_codex_once']['current_price_cny'] == 4
    assert r153['new_evidence']['morimm_codex_once']['actual_payment_total_cny'] is None
    assert r153['new_evidence']['morimm_codex_once']['codex_sms_success_tested'] is False
    assert r153['new_evidence']['morimm_plus_recheck']['price_cny'] == 114
    assert r153['new_evidence']['redeem_portal']['session_json_or_access_token_requested'] is True
    assert r153['new_evidence']['redeem_portal']['first_web_login_sms_can_be_bypassed'] is False
    assert all(v is None for v in r153['unknown_costs'].values())
    assert all(v == 0 for v in r153['qualification_totals'].values())
    # R154: documented seller claims are not verified SMS service restoration, whole-price or wholesale rights.
    assert by_id['gpt-source-followup-r154-20261112']['url'] == '../research/2026-11-12/supplier-followup-20261112-r7.html'
    assert by_id['gpt-source-followup-r154-20261112-evidence']['url'] == '../research/2026-11-12/supplier-followup-20261112-r7-evidence.json'
    r154 = json.loads((ROOT/'dist/research/2026-11-12/supplier-followup-20261112-r7-evidence.json').read_bytes())
    assert r154['round'] == 154 and r154['site_version'] == '1.9.162'
    assert len(r154['sources']) == 8
    p154 = r154['new_evidence']['gpthub_plus_appstore_listing']
    assert p154['displayed_price_cny_per_item'] == 169 and p154['all_required_fees_verified_cny'] is None
    assert p154['proven_same_sku_price_increase'] is False
    assert r154['new_evidence']['gpthub_terms']['phone_verification_failure_excluded_from_subscription_aftersales'] is True
    sms154 = r154['new_evidence']['gpthub_sms_announcements']
    assert sms154['seller_claims_service_restored'] is True and sms154['verified_actual_service_restored'] is False
    assert sms154['sms_endpoint_fetch_status'] == 'fetch_failed_502'
    assert sms154['supports_codex_desktop_sms_verified'] is None
    assert all(value is None for value in r154['unknown_costs'].values())
    assert all(value == 0 for value in r154['qualification_totals'].values())
    assert r154['purchase_or_login_attempted'] is False and r154['merchant_contacted'] is False
    # R155: independently read SMS source offerings; voucher window must not be confused with persistent phone rental.
    assert by_id['gpt-source-followup-r155-20261112']['url'] == '../research/2026-11-12/supplier-followup-20261112-r8.html'
    assert by_id['gpt-source-followup-r155-20261112-evidence']['url'] == '../research/2026-11-12/supplier-followup-20261112-r8-evidence.json'
    r155 = json.loads((ROOT/'dist/research/2026-11-12/supplier-followup-20261112-r8-evidence.json').read_bytes())
    assert r155['round'] == 155 and r155['site_version'] == '1.9.163' and len(r155['sources']) == 5
    b155 = r155['new_evidence']['boaile_single_sms']
    assert [x['displayed_price_cny_per_voucher'] for x in b155['offer_variants']] == [2.99, 4.99]
    assert b155['page_contains_payment_demo'] and not b155['real_order_or_checkout_verified']
    assert b155['voucher_valid_days_from_payment_claim'] == 30 and b155['voucher_grace_end_days_from_payment_claim'] == 60
    assert b155['actual_number_retention_days'] is None and b155['sms_not_received_cash_refund_rule'] is None
    j155 = r155['new_evidence']['jiema91_long_rental']
    assert (j155['claimed_long_term_number_days_min'],j155['claimed_long_term_number_days_max']) == (12,90)
    assert j155['listing_price_cny'] is None and j155['listing_price_usd'] is None
    assert j155['merchant_claim_all_chatgpt_accounts_need_sms'] and not j155['official_says_all_chatgpt_accounts_need_sms']
    assert j155['merchant_terms_paid_delivered_service_nonrefundable'] and not j155['operator_registered_verified']
    assert all(v is None for v in r155['unknown_costs'].values())
    assert all(v == 0 for v in r155['qualification_totals'].values())
    assert not r155['purchase_or_login_attempted'] and not r155['merchant_contacted']
    # R156: arithmetic invoice estimate is not a paid valid-VAT transaction.
    r156=json.loads((ROOT / 'dist/research/2026-11-12/supplier-followup-20261112-r9-evidence.json').read_bytes())
    assert r156['round']==156 and r156['site_version']=='1.9.164' and len(r156['sources'])==3
    offer=r156['new_evidence']['dunling_retail_plus']
    assert offer['list_price_cny_per_account_month']==149 and offer['invoice_fee_if_list_price_cny']==15
    assert offer['arithmetic_price_with_invoice_cny']==164 and offer['real_invoiced_total_cny'] is None
    assert offer['wholesale_unit_price_cny'] is None and not offer['official_openai_resale_authorization_verified']
    assert all(x==0 for x in r156['qualification_totals'].values())
    # R157: checkout preview, guest invoice contradiction and no real SMS or VAT test.
    assert by_id['gpt-source-followup-r157-20261112']['url'] == '../research/2026-11-12/supplier-followup-20261112-r10.html'
    assert by_id['gpt-source-followup-r157-20261112-evidence']['url'] == '../research/2026-11-12/supplier-followup-20261112-r10-evidence.json'
    r157 = json.loads((ROOT / 'dist/research/2026-11-12/supplier-followup-20261112-r10-evidence.json').read_bytes())
    assert r157['round'] == 157 and r157['site_version'] == '1.9.165' and len(r157['sources']) == 6
    offer157 = r157['new_evidence']['catfk_aidp_xoyimh']
    assert (offer157['displayed_listing_price_cny'], offer157['displayed_wechat_preview_total_cny'], offer157['displayed_wechat_fee_cny']) == (117.46, 120.75, 3.29)
    assert offer157['all_required_invoiced_checkout_cny'] is None and offer157['wholesale_unit_price_cny'] is None
    assert r157['new_evidence']['wind89_guest_invoice_conflict']['contradiction_unresolved'] is True
    assert r157['new_evidence']['jiema91_short_term_number']['merchant_claim_short_standard_number_approx_minutes'] == 30
    assert all(v == 0 for v in r157['qualification_totals'].values())

    # R158: same retail SKU and live public payment-channel availability changes, not verified checkout or invoice.
    assert by_id['gpt-source-followup-r158-20261112']['url'].endswith('supplier-followup-20261112-r11.html')
    assert by_id['gpt-source-followup-r158-20261112-evidence']['url'].endswith('supplier-followup-20261112-r11-evidence.json')
    r158 = json.loads((ROOT / 'dist/research/2026-11-12/supplier-followup-20261112-r11-evidence.json').read_bytes())
    assert r158['round'] == 158 and r158['site_version'] == '1.9.166' and len(r158['sources']) == 4
    offer158 = r158['new_evidence']['payforgpt_sku7_payment_channel_comparison']
    assert offer158['previous_displayed_channels'] == ['Alipay','WeChat Pay','USDT','manual bank transfer']
    assert offer158['current_merchant_named_channels'] == ['Alipay','manual bank transfer']
    assert offer158['merchant_now_explicit_wechat_payment_unavailable'] is True
    assert offer158['usdt_service_formally_disabled_verified'] is None
    assert offer158['displayed_price_cny_per_month_current'] == 160 and offer158['actual_paid_cny'] is None
    assert offer158['all_required_fees_invoice_included_total_cny'] is None
    assert r158['new_evidence']['payforgpt_enterprise_invoice_recheck']['single_unit_china_vat_invoice_available_verified'] is None
    assert all(v == 0 for v in r158['qualification_totals'].values())
    assert not r158['purchase_or_login_attempted'] and not r158['merchant_contacted']

    # R159: same exact original-account single-month Plus SKUs, two dated retail snapshots.
    assert by_id['gpt-source-followup-r159-20261112']['url'].endswith('supplier-followup-20261112-r12.html')
    assert by_id['gpt-source-followup-r159-20261112-evidence']['url'].endswith('supplier-followup-20261112-r12-evidence.json')
    r159 = json.loads((ROOT / 'dist/research/2026-11-12/supplier-followup-20261112-r12-evidence.json').read_bytes())
    assert r159['round'] == 159 and r159['site_version'] == '1.9.167' and len(r159['sources']) == 6
    offer159 = r159['new_evidence']['chatgqt_plus_same_sku_price_snapshot_comparison']
    assert (offer159['no_warranty_previous_displayed_cny'],offer159['no_warranty_current_displayed_cny']) == (125,135)
    assert (offer159['warranty_previous_displayed_cny'],offer159['warranty_current_displayed_cny']) == (135,145)
    assert offer159['formal_price_change_effective_date'] is None
    assert offer159['actual_checkout_with_valid_china_vat_cny'] is None
    assert offer159['wholesale_agent_entry_fee_cny'] == 3000
    assert offer159['wholesale_unit_price_cny'] is None
    assert not offer159['qualified_wholesale_upstream']
    assert all(v == 0 for v in r159['qualification_totals'].values())


    # R160: new retailer must not be upgraded to authorized single-unit wholesale or SMS success.
    assert by_id['gpt-source-followup-r160-20261113']['url'].endswith('supplier-followup-20261113.html')
    assert by_id['gpt-source-followup-r160-20261113-evidence']['url'].endswith('supplier-followup-20261113-evidence.json')
    r160 = json.loads((ROOT / 'dist/research/2026-11-13/supplier-followup-20261113-evidence.json').read_bytes())
    assert r160['round'] == 160 and r160['site_version'] == '1.9.168' and len(r160['sources']) == 6
    new160 = r160['new_evidence']
    assert [v['displayed_cny_per_account_month'] for v in new160['original_account_plus_skus']] == [125,138]
    assert new160['wholesale']['merchant_minimum_quantity'] == 10
    assert new160['wholesale']['merchant_displayed_cny_per_item'] == 113
    assert new160['wholesale']['one_unit_wholesale_available_verified'] is False
    assert new160['invoice']['merchant_claim_minimum_cny'] == 10
    assert new160['invoice']['invoice_issuer_entity'] is None
    assert new160['invoice']['all_required_payment_and_invoice_fees_total_cny'] is None
    assert new160['independent_phone']['store_display_cny_per_code'] == 10
    assert new160['independent_phone']['holding_days'] is None
    assert new160['independent_phone']['failed_sms_cash_refund'] is None
    assert all(v == 0 for v in r160['qualification_totals'].values())
    assert r160['purchase_or_login_attempted'] is False and r160['merchant_contacted'] is False

    # R161 keeps unpaid checkout preview and seller invoice claims separate from verified VAT.
    assert by_id['gpt-source-followup-r161-20261113']['url'].endswith('supplier-followup-20261113-r2.html')
    assert by_id['gpt-source-followup-r161-20261113-evidence']['url'].endswith('supplier-followup-20261113-r2-evidence.json')
    r161=json.loads((ROOT/'dist/research/2026-11-13/supplier-followup-20261113-r2-evidence.json').read_bytes())
    assert r161['round']==161 and r161['site_version']=='1.9.169'
    assert r161['plus']['sku']=='G34816878'
    assert r161['plus']['merchant_display_cny_per_item_month']==108.99
    assert r161['plus']['checkout_preview_rounded_total_cny']==112.04
    assert r161['plus']['arithmetical_sum_checkout_preview_plus_invoice_claim_cny']==162.04
    assert r161['plus']['actual_paid_with_valid_china_vat_cny'] is None
    assert r161['invoice']['invoice_verified'] is False
    assert r161['merchant']['one_unit_wholesale_price_cny'] is None
    assert r161['sms']['sku']=='G33329430'
    assert r161['sms']['number_holding_days'] is None
    assert r161['sms']['failed_sms_cash_refund'] is None
    assert all(x==0 for x in r161['qualification_totals'].values())
    assert r161['purchase_or_login_attempted'] is False and r161['merchant_contacted'] is False

    # R162: 52XUEAI guest retail checkout preview does not prove VAT or wholesale authorization.
    assert by_id['gpt-source-followup-r162-20261113']['url'].endswith('supplier-followup-20261113-r3.html')
    assert by_id['gpt-source-followup-r162-20261113-evidence']['url'].endswith('supplier-followup-20261113-r3-evidence.json')
    r162 = json.loads((ROOT/'dist/research/2026-11-13/supplier-followup-20261113-r3-evidence.json').read_bytes())
    assert r162['round'] == 162 and r162['site_version'] == '1.9.170'
    assert r162['plus']['sku'] == 'G37392923'
    assert r162['plus']['merchant_display_cny_per_item_month'] == 116
    assert r162['plus']['unpaid_checkout_preview_payment_fee_cny'] == 3.248
    assert r162['plus']['unpaid_checkout_preview_total_cny'] == 119.25
    assert r162['invoice']['merchant_claim_invoice_fee_cny'] is None
    assert r162['invoice']['actual_all_in_with_valid_china_vat_cny'] is None
    assert r162['merchant']['actual_payment_entity'] is None
    assert r162['merchant']['one_unit_wholesale_price_cny'] is None
    assert r162['phone_verification']['new_independent_sms_sku_found_this_round'] is False
    assert all(v == 0 for v in r162['qualification_totals'].values())
    assert r162['purchase_or_login_attempted'] is False and r162['merchant_contacted'] is False

    # R163: manual Codex SMS flow terms are webpage claims, not paid/verified SMS.
    assert by_id['gpt-source-followup-r163-20261113']['url'].endswith('supplier-followup-20261113-r4.html')
    assert by_id['gpt-source-followup-r163-20261113-evidence']['url'].endswith('supplier-followup-20261113-r4-evidence.json')
    r163 = json.loads((ROOT/'dist/research/2026-11-13/supplier-followup-20261113-r4-evidence.json').read_bytes())
    assert r163['round'] == 163 and r163['site_version'] == '1.9.171'
    assert r163['phone_verification']['displayed_price_cny_per_one_cdk'] == 3
    assert r163['phone_verification']['manual_mode_button_visible'] is True
    assert r163['phone_verification']['manual_mode_merchant_claim_cdk_consumed_when_sms_received_even_if_final_verification_not_done'] is True
    assert r163['phone_verification']['merchant_claim_sms_code_visible_hours'] == 24
    assert r163['phone_verification']['phone_number_holding_days_verified'] is None
    assert r163['phone_verification']['cash_refund_for_failed_verification_verified'] is None
    assert r163['phone_verification']['manual_or_automatic_flow_real_tested'] is False
    assert r163['plus']['redeem_maintenance_notice_still_displayed'] is True
    assert r163['plus']['actual_all_in_with_valid_china_vat_cny'] is None
    assert all(value == 0 for value in r163['qualification_totals'].values())
    assert r163['purchase_or_login_attempted'] is False and r163['merchant_contacted'] is False

    # R164: unpaid platform previews are not valid-China-VAT or authorized wholesale proof.
    assert by_id['gpt-source-followup-r164-20261113']['url'].endswith('supplier-followup-20261113-r5.html')
    assert by_id['gpt-source-followup-r164-20261113-evidence']['url'].endswith('supplier-followup-20261113-r5-evidence.json')
    r164 = json.loads((ROOT/'dist/research/2026-11-13/supplier-followup-20261113-r5-evidence.json').read_bytes())
    assert r164['round'] == 164 and r164['site_version'] == '1.9.172'
    assert [p['merchant_product_id'] for p in r164['candidates']] == ['G46459749', 'G64783075']
    assert [p['unpaid_checkout_preview_total_cny'] for p in r164['candidates']] == [118.22,138.78]
    assert all(p['actual_all_in_china_vat_cny'] is None for p in r164['candidates'])
    assert all(p['merchant_wholesale_one_unit_cost_cny'] is None for p in r164['candidates'])
    assert all(p['merchant_workflow_requires_session_token'] for p in r164['candidates'])
    assert all(v == 0 for v in r164['qualification_totals'].values())


    # R165: item-level public prices and merchant claims are not an authorized, VAT-invoiced wholesale purchase.
    assert by_id['gpt-source-followup-r165-20261113']['url'].endswith('supplier-followup-20261113-r6.html')
    assert by_id['gpt-source-followup-r165-20261113-evidence']['url'].endswith('supplier-followup-20261113-r6-evidence.json')
    r165 = json.loads((ROOT/'dist/research/2026-11-13/supplier-followup-20261113-r6-evidence.json').read_bytes())
    assert r165['round'] == 165 and r165['site_version'] == '1.9.173'
    assert r165['plus_candidate']['merchant_product_id'] == 'G11162247'
    assert r165['plus_candidate']['display_price_cny_per_item_30days'] == 108.49
    assert r165['plus_candidate']['unpaid_checkout_preview_total_cny'] == 111.53
    assert r165['plus_candidate']['china_vat_invoice_fee_cny'] is None
    assert r165['plus_candidate']['actual_all_in_with_valid_china_vat_cny'] is None
    assert r165['plus_candidate']['single_unit_wholesale_price_cny'] is None
    assert r165['independent_sms']['merchant_product_id'] == 'G88621777'
    assert r165['independent_sms']['display_price_cny_per_code'] == 0.53
    assert r165['independent_sms']['actual_number_holding_days'] is None
    assert r165['independent_sms']['cash_refund_for_nonuser_sms_failure_verified'] is None
    assert all(v == 0 for v in r165['qualification_totals'].values())

    # R166: public price and alleged 5% invoicing are neither valid VAT nor a legal upstream quotation.
    assert by_id['gpt-source-followup-r166-20261113']['url'].endswith('supplier-followup-20261113-r7.html')
    assert by_id['gpt-source-followup-r166-20261113-evidence']['url'].endswith('supplier-followup-20261113-r7-evidence.json')
    r166 = json.loads((ROOT/'dist/research/2026-11-13/supplier-followup-20261113-r7-evidence.json').read_bytes())
    assert r166['round'] == 166 and r166['site_version'] == '1.9.174'
    c166 = r166['new_candidate']
    assert c166['merchant_product_id'] == 'G25949013'
    assert c166['display_price_cny'] == 116.98 and c166['unpaid_checkout_preview_payment_fee_cny'] == 3.2754
    assert c166['merchant_claim_invoice_or_corporate_payment_extra_fee_percent'] == 5
    assert c166['china_vat_invoice_fee_cny'] is None and c166['real_vat_all_fees_included_total_cny'] is None
    assert c166['one_unit_wholesale_price_cny'] is None and c166['agent_upfront_fee_cny'] is None
    assert c166['renewal_terms_conflict_unresolved'] is True
    assert r166['independent_phone_verification']['number_holding_days'] is None
    assert all(v == 0 for v in r166['qualification_totals'].values())
    assert r166['purchase_or_login_attempted'] is False and r166['merchant_contacted'] is False

    # R167: vendor phone service offers are neither Plus wholesale nor real SMS verification.
    assert by_id['gpt-source-followup-r167-20261113']['url'].endswith('supplier-followup-20261113-r8.html')
    assert by_id['gpt-source-followup-r167-20261113-evidence']['url'].endswith('supplier-followup-20261113-r8-evidence.json')
    r167=json.loads((ROOT/'dist/research/2026-11-13/supplier-followup-20261113-r8-evidence.json').read_bytes())
    assert r167['round'] == 167 and r167['site_version'] == '1.9.175'
    short,long=r167['independent_sms_candidates']
    assert short['display_price_cny'] == 29.9 and short['merchant_claim_free_number_changes_max'] == 3
    assert short['actual_number_holding_minutes'] is None and short['actual_sms_success_verified'] is False
    assert [(x['duration_days'],x['price_cny']) for x in long['offers']] == [(30,149),(90,399),(365,1199)]
    assert long['merchant_claim_no_refund_if_openai_rejects_number'] is True
    assert long['actual_exclusive_or_renewal_verified'] is False
    assert r167['plus_purchase_gap']['actual_all_required_fees_included_cny'] is None
    assert all(v == 0 for v in r167['qualification_totals'].values())
    assert r167['purchase_or_login_attempted'] is False and r167['merchant_contacted'] is False


    # R168: supplier-owned SMS country "from" pricing and wallet-only refund do not prove OpenAI success, real US checkout or Plus wholesale.
    assert by_id['gpt-source-followup-r168-20261113']['url'].endswith('supplier-followup-20261113-r9.html')
    assert by_id['gpt-source-followup-r168-20261113-evidence']['url'].endswith('supplier-followup-20261113-r9-evidence.json')
    r168=json.loads((ROOT/'dist/research/2026-11-13/supplier-followup-20261113-r9-evidence.json').read_bytes())
    assert r168['round'] == 168 and r168['site_version'] == '1.9.176' and len(r168['sources']) == 6
    sms168=r168['independent_sms_candidate']
    assert [(x['country'],x['price_usd_from']) for x in sms168['merchant_displayed_country_starting_prices']] == [
        ('Philippines',0.11),('United Kingdom',0.13),('Brazil',0.19),('Indonesia',0.19),('United States',None)]
    assert sms168['minimum_balance_topup_usd_from'] == 2.5 and sms168['minimum_card_topup_usd_from'] == 5
    assert sms168['actual_chosen_sku_checkout_price_usd'] is None and sms168['actual_controlled_number_holding_days'] is None
    assert sms168['no_sms_refund_destination'].startswith('nonwithdrawable platform balance')
    assert sms168['actual_cash_refund_verified'] is False and sms168['actual_openai_verification_success'] is False
    assert all(v == 0 for v in r168['qualification_totals'].values())
    assert r168['purchase_or_login_attempted'] is False and r168['merchant_contacted'] is False

    # R171: AIBulk Lv1 retail quote is not complete Chinese VAT legal wholesale.
    assert by_id['gpt-source-followup-r171-20261113']['url'].endswith('supplier-followup-20261113-r12.html')
    assert by_id['gpt-source-followup-r171-20261113-evidence']['url'].endswith('supplier-followup-20261113-r12-evidence.json')
    r171=json.loads((ROOT/'dist/research/2026-11-13/supplier-followup-20261113-r12-evidence.json').read_bytes())
    assert r171['round']==171 and r171['site_version']=='1.9.179' and len(r171['sources'])==10
    new=r171['new_plus_reseller_candidate']
    assert new['observed_lv1_price_usd_per_one_month_one_item']==17.99
    assert new['merchant_claim_complete_session_json_required'] is True
    assert new['actual_all_required_fees_and_valid_china_vat_cny'] is None
    assert new['formal_openai_supply_and_resale_authorization_verified'] is False
    assert all(x==0 for x in r171['qualification_totals'].values())
    assert r171['purchase_or_login_attempted'] is False and r171['merchant_contacted'] is False

    # R172: distinct Go SKU and 2026-11-13 API failure must not imply tested renewal.
    assert by_id['gpt-source-followup-r172-20261113']['url'].endswith('supplier-followup-20261113-r13.html')
    assert by_id['gpt-source-followup-r172-20261113-evidence']['url'].endswith('supplier-followup-20261113-r13-evidence.json')
    r172 = json.loads((ROOT/'dist/research/2026-11-13/supplier-followup-20261113-r13-evidence.json').read_bytes())
    assert r172['round']==172 and r172['site_version']=='1.9.180' and len(r172['sources'])==6
    found=r172['new_findings']
    assert found['free_to_plus_sku']['advertised_lv1_usd_per_item_month']==17.99
    assert found['go_to_plus_sku']['advertised_lv1_usd_per_item_month']==19.99
    assert found['go_to_plus_sku']['remaining_go_days_preserved'] is False
    assert found['api_v170_change']['merchant_claim_release_date']=='2026-11-13'
    assert found['api_v170_change']['nonfree_http_status']==400
    assert found['earlier_renewal_change']['merchant_claim_rule_date']=='2026-11-04'
    assert found['earlier_renewal_change']['same_tier_active_plus_http_status']==409
    assert found['cost_and_authority']['all_required_fees_and_valid_china_vat_cny'] is None
    assert all(x==0 for x in r172['qualification_totals'].values())
    assert r172['purchase_or_login_attempted'] is False and r172['merchant_contacted'] is False

    # R173: EVI is an unqualified guest retail offer; session and cash refund limits explicit.
    assert by_id['gpt-source-followup-r173-20261114']['url'].endswith('supplier-followup-20261114.html')
    assert by_id['gpt-source-followup-r173-20261114-evidence']['url'].endswith('supplier-followup-20261114-evidence.json')
    r173 = json.loads((ROOT/'dist/research/2026-11-14/supplier-followup-20261114-evidence.json').read_bytes())
    assert r173['round']==173 and r173['site_version']=='1.9.181' and len(r173['sources'])==7
    offer=r173['new_retail_candidate']
    assert offer['advertised_unit_price']==16.8 and offer['currency']=='USDT'
    assert offer['session_token_required'] is True and offer['first_chatgpt_web_login_required'] is True
    assert offer['refund_to_site_balance_only_in_terms'] is True
    assert offer['all_required_fees_with_valid_china_vat_cny'] is None
    assert offer['formal_openai_resale_authorization_verified'] is False
    assert all(x==0 for x in r173['qualification_totals'].values())
    assert r173['purchase_or_login_attempted'] is False and r173['merchant_contacted'] is False

    # R174: phone-only signup and API phone verification are different; no third-party verification success claim.
    assert by_id['gpt-source-followup-r174-20261114']['url'].endswith('supplier-followup-20261114-r2.html')
    assert by_id['gpt-source-followup-r174-20261114-evidence']['url'].endswith('supplier-followup-20261114-r2-evidence.json')
    r174 = json.loads((ROOT/'dist/research/2026-11-14/supplier-followup-20261114-r2-evidence.json').read_bytes())
    assert r174['round']==174 and r174['site_version']=='1.9.182' and len(r174['sources'])==10
    assert r174['official_verification_findings']['api_first_key_verification']['phone_number_max_distinct_verified_accounts']==3
    assert r174['official_verification_findings']['api_first_key_verification']['deleting_account_resets_api_phone_verification_quota'] is False
    assert r174['official_verification_findings']['number_association']['changing_or_updating_number_supported'] is False
    assert r174['official_verification_findings']['phone_only_signup']['plus_pro_business_require_verified_email'] is True
    assert r174['official_verification_findings']['phone_only_signup']['separate_from_api_first_key_verification'] is True
    assert r174['costs']['new_all_required_fees_valid_china_vat_cny'] is None
    assert all(x==0 for x in r174['qualification_totals'].values())
    assert r174['purchase_or_login_attempted'] is False and r174['merchant_contacted'] is False

    # R175: published official terms are dated January; business integration and partner claims do not prove Plus subscription distribution.
    assert by_id['gpt-source-followup-r175-20261114']['url'].endswith('supplier-followup-20261114-r3.html')
    assert by_id['gpt-source-followup-r175-20261114-evidence']['url'].endswith('supplier-followup-20261114-r3-evidence.json')
    r175 = json.loads((ROOT/'dist/research/2026-11-14/supplier-followup-20261114-r3-evidence.json').read_bytes())
    assert r175['round']==175 and r175['site_version']=='1.9.183' and len(r175['sources'])==6
    assert r175['authorization_findings']['consumer_terms']['terms_effective_on']=='2026-01-01'
    assert r175['authorization_findings']['consumer_terms']['credentials_sharing_or_account_access_sharing_prohibited'] is True
    assert r175['authorization_findings']['business_agreement']['api_integration_permission_is_not_consumer_plus_resale_permission'] is True
    assert r175['authorization_findings']['partner_network']['seller_membership_or_consumer_plus_distribution_right_for_any_candidate_verified'] is False
    assert r175['costs']['new_all_required_fees_valid_china_vat_cny'] is None
    assert all(x==0 for x in r175['qualification_totals'].values())
    assert r175['purchase_or_login_attempted'] is False and r175['merchant_contacted'] is False

    # R177: mock checkout and account-password MOQ cannot qualify as own-account Plus supply.
    assert by_id['gpt-source-followup-r177-20261114']['url'].endswith('supplier-followup-20261114-r5.html')
    assert by_id['gpt-source-followup-r177-20261114-evidence']['url'].endswith('supplier-followup-20261114-r5-evidence.json')
    r177=json.loads((ROOT/'dist/research/2026-11-14/supplier-followup-20261114-r5-evidence.json').read_bytes())
    assert r177['round']==177 and r177['site_version']=='1.9.185' and len(r177['sources'])==11
    sms=r177['new_independent_sms_provider']
    assert sms['minimum_wallet_funding_usd']==10 and sms['rates']['united_states']['price_usd_per_otp_session']==0.45
    assert sms['session_minutes']==10 and sms['no_sms_within_ten_minutes']['refund_destination']=='bot_wallet_balance'
    assert sms['fund_balance_cash_withdrawal_supported'] is None and sms['actual_sms_purchase_or_test'] is False
    assert r177['new_supplier_screens'][0]['actual_real_payment_support_confirmed'] is False
    assert r177['new_supplier_screens'][1]['minimum_order_quantity']==50 and r177['new_supplier_screens'][1]['user_original_account_supported'] is False
    assert all(x==0 for x in r177['qualification_totals'].values())
    assert r177['actual_purchase_or_sms_test_performed'] is False and r177['historical_prices_refreshed'] is False


    # R178: merchant-declared corporate invoice is explicitly not Chinese VAT; phone OTP conditions are not real outcomes.
    assert by_id['gpt-source-followup-r178-20261114']['url'].endswith('supplier-followup-20261114-r6.html')
    assert by_id['gpt-source-followup-r178-20261114-evidence']['url'].endswith('supplier-followup-20261114-r6-evidence.json')
    r178=json.loads((ROOT/'dist/research/2026-11-14/supplier-followup-20261114-r6-evidence.json').read_bytes())
    assert r178['round']==178 and r178['site_version']=='1.9.186'
    assert r178['plus_supplier']['wholesale_min_quantity']==10
    assert r178['plus_supplier']['wholesale_price_usd_per_account'] is None
    assert r178['plus_supplier']['enterprise_china_vat_invoice_available'] is False
    assert r178['sms_service']['display_price_usd_per_number']==4.99
    assert r178['sms_service']['retain_days']==21
    assert r178['sms_service']['merchant_claims_original_payment_refund_when_all_replacement_numbers_no_sms'] is True
    assert r178['sms_service']['independent_verified_original_payment_refund'] is False
    assert all(x==0 for x in r178['qualification_totals'].values())
    assert r178['actual_purchase_or_sms_test_performed'] is False

    # R179: SMS Portal OpenAI-US one-time OTP is not a Plus wholesaler or successful phone verification.
    assert by_id['gpt-source-followup-r179-20261114']['url'].endswith('supplier-followup-20261114-r7.html')
    assert by_id['gpt-source-followup-r179-20261114-evidence']['url'].endswith('supplier-followup-20261114-r7-evidence.json')
    r179=json.loads((ROOT/'dist/research/2026-11-14/supplier-followup-20261114-r7-evidence.json').read_bytes())
    sms179=r179['new_independent_sms_provider']
    assert r179['round']==179 and r179['site_version']=='1.9.187'
    assert sms179['retail_display_price_usd_per_one_otp']==0.33
    assert sms179['actual_all_in_payment_cost_usd'] is None
    assert sms179['automatic_no_sms_refund_to']=='nonwithdrawable_platform_wallet_balance'
    assert sms179['terms_balance_redeemable_for_cash'] is False
    assert sms179['openai_month_rental_30_day_price_usd'] is None
    assert sms179['real_first_api_key_success'] is False
    assert all(x==0 for x in r179['qualification_totals'].values())
    assert r179['historical_prices_refreshed'] is False and r179['actual_purchase_or_sms_test_performed'] is False

    # R180: exact Plus retailer invoice contradiction; not a verified wholesale or paid test.
    assert by_id['gpt-source-followup-r180-20261114']['url'].endswith('supplier-followup-20261114-r8.html')
    assert by_id['gpt-source-followup-r180-20261114-evidence']['url'].endswith('supplier-followup-20261114-r8-evidence.json')
    r180=json.loads((ROOT/'dist/research/2026-11-14/supplier-followup-20261114-r8-evidence.json').read_bytes())
    assert r180['round']==180 and r180['site_version']=='1.9.188'
    retail180=r180['new_retail_candidate']
    assert retail180['display_price_cny_per_30_days']==149
    assert retail180['invoice_statement_conflict'] is True
    assert retail180['confirmed_valid_china_vat_invoice_available'] is None
    assert retail180['real_all_required_fees_invoice_included_cny'] is None
    assert retail180['session_token_required'] is True
    assert retail180['official_consumer_plus_distribution_authorization_verified'] is False
    assert all(x==0 for x in r180['qualification_totals'].values())
    assert r180['historical_prices_refreshed'] is False and r180['actual_purchase_or_sms_test_performed'] is False

    # R181: compare identical SKU G62975691 merchant stock display on two observation dates.
    assert by_id['gpt-source-followup-r181-20261114']['url'].endswith('supplier-followup-20261114-r9.html')
    assert by_id['gpt-source-followup-r181-20261114-evidence']['url'].endswith('supplier-followup-20261114-r9-evidence.json')
    r181=json.loads((ROOT/'dist/research/2026-11-14/supplier-followup-20261114-r9-evidence.json').read_bytes())
    assert r181['round']==181 and r181['site_version']=='1.9.189'
    change=r181['material_change']
    assert change['exact_sku_id']=='G62975691'
    assert change['prior_merchant_stock_label']=='有货'
    assert change['current_merchant_stock_label']=='暂时缺货'
    assert change['current_display_price_cny_per_account_month']==128.8
    assert change['price_change_observed'] is False
    assert change['real_inventory_or_transaction_tested'] is False
    assert change['checkout_payment_fee_cny'] is None
    assert change['real_all_in_plus_china_vat_cost_cny'] is None
    assert change['retailer_service_permanently_discontinued_verified'] is False
    assert change['eligible_upstream_under_user_criteria'] is False
    assert all(v==0 for v in r181['qualification_totals'].values())
    assert r181['historical_126_prices_modified'] is False
    assert r181['actual_purchase_or_sms_test_performed'] is False

    # R188: merchant invoice minimum fee is publicly displayed, but VAT invoice, payment and wholesaling are not verified.
    assert by_id['gpt-source-followup-r188-20261114']['url'].endswith('supplier-followup-20261114-r16.html')
    assert by_id['gpt-source-followup-r188-20261114-evidence']['url'].endswith('supplier-followup-20261114-r16-evidence.json')
    r188 = json.loads((ROOT/'dist/research/2026-11-14/supplier-followup-20261114-r16-evidence.json').read_bytes())
    assert r188['round'] == 188 and r188['site_version'] == '1.9.196'
    c188 = r188['new_retail_candidate']
    assert c188['displayed_retail_price_cny_per_account_month'] == 149
    assert c188['additional_invoice_fee_rule_merchant_claim']['minimum_cny'] == 15
    assert c188['plus_invoiced_derived_sum_conditional_cny'] == 164
    assert c188['total_verified_with_valid_china_vat_cny'] is None
    assert c188['chinese_vat_invoice_claim']['verified_invoice'] is False
    assert c188['bona_fide_wholesale_verified'] is False
    assert c188['session_json_transferred_to_third_party_claim'] is True
    assert r188['qualification_totals']['verified_plus_wholesale_upstreams'] == 0
    assert r188['actual_purchase_or_sms_test_performed'] is False

    print('PASS: approved exact public artifacts, preserved historical evidence, two pinned archives, return/download links and evidence boundaries')


if __name__ == '__main__': validate_publications()
