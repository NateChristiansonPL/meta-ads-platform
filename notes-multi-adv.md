# Multi-Advertiser API Findings

From Meta docs (https://developers.facebook.com/documentation/ads-commerce/marketing-api/creative/multi-advertiser-ads):

1. `contextual_multi_ads` is a field on **Ad Creative** (set during creation at /act_<ID>/adcreatives)
2. The `enroll_status` field can be OPT_IN or OPT_OUT
3. **Key insight**: "Ads created on or after August 19, 2024 that do not specify the enroll_status field will be opted into multi-advertiser ads by default."

This means:
- If the field is NOT returned by the API when reading a creative, the ad is effectively OPT_IN (opted in by default)
- My current detection logic only triggers when the field IS present AND not OPT_OUT
- The fix: if `contextual_multi_ads` is missing/undefined, treat it as OPT_IN (violation)

Need to also check: does the API actually return `contextual_multi_ads` when reading a creative?
From the Ad Account Ad Creatives reference page snippet: "contextual_multi_ads" is listed as a readable field.

So the issue is likely:
- The field IS being fetched but Meta returns it as undefined/null for creatives that were opted in by default (never explicitly set)
- OR the field name needs to be in the fields parameter differently

Let me check what the actual API returns by looking at how fixAdDofSpec uses it.
