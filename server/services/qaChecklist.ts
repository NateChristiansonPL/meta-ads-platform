/**
 * qaChecklist.ts — Native Ad QA Checklist service.
 *
 * Ports the Python ad-qa-checklist skill to TypeScript.
 * Makes 4 batch API calls to Meta Graph API, validates degrees_of_freedom_spec,
 * generates a two-tab XLSX report, uploads to S3, and returns the download URL.
 */

import axios from "axios";
import ExcelJS from "exceljs";
import { storagePut } from "../storage";

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const GRAPH_API_VERSION = "v21.0";
const BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
const BATCH_SIZE = 50;

// ═══════════════════════════════════════════════════════════════════════════════
// EXPECTED DEGREES OF FREEDOM SPECS (all settings OFF)
// ═══════════════════════════════════════════════════════════════════════════════

const EXPECTED_SPECS: Record<string, any> = {
  STATIC_NO_PAC: {"creative_features_spec":{"product_extensions":{"enroll_status":"OPT_OUT"},"adapt_to_placement":{"customizations":{"aspect_ratio_config":{}},"enroll_status":"OPT_OUT"},"add_text_overlay":{"enroll_status":"OPT_OUT"},"ads_with_benefits":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"advantage_plus_creative":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"app_highlights":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"audio":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"biz_ai":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"carousel_to_video":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"catalog_feed_tag":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"creative_stickers":{"enroll_status":"OPT_OUT"},"cv_transformation":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"description_automation":{"enroll_status":"OPT_OUT"},"dynamic_partner_content":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"enhance_cta":{"enroll_status":"OPT_OUT"},"feed_caption_optimization":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"generate_cta":{"enroll_status":"OPT_OUT"},"hide_price":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"ig_glados_feed":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"ig_video_native_subtitle":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"image_animation":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"image_auto_crop":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"image_background_gen":{"enroll_status":"OPT_OUT"},"image_brightness_and_contrast":{"enroll_status":"OPT_OUT"},"image_enhancement":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"image_templates":{"enroll_status":"OPT_OUT"},"image_text_translation":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"image_touchups":{"enroll_status":"OPT_OUT"},"image_uncrop":{"enroll_status":"OPT_OUT"},"inline_comment":{"enroll_status":"OPT_OUT"},"local_store_extension":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"media_liquidity_animated_image":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"media_order":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"media_type_automation":{"enroll_status":"OPT_OUT"},"multi_photo_to_video":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"pac_recomposition":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"pac_relaxation":{"enroll_status":"OPT_OUT"},"product_browsing":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"product_metadata_automation":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"profile_card":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"replace_media_text":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"reveal_details_over_time":{"enroll_status":"OPT_OUT"},"show_destination_blurbs":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"show_summary":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"site_extensions":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"standard_enhancements_catalog":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"text_optimizations":{"enroll_status":"OPT_OUT"},"text_translation":{"action_metadata":{"type":"MANUAL"},"enroll_status":"OPT_OUT"},"translate_voiceover":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"video_auto_crop":{"enroll_status":"OPT_OUT"},"video_filtering":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"video_highlight":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"video_highlights":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"video_to_image":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"video_uncrop":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"wa_mm_image_filtering":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"enable_ncs_testimonials":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"dha_optimization":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"}},"creative_sourcing_spec":{"app_info_spec":{"enroll_status":"OPT_OUT"},"brand":{"enroll_status":"OPT_OUT"},"dynamic_site_links_spec":{"enroll_status":"OPT_OUT"},"featured_offering_spec":{"enroll_status":"OPT_OUT","media":[]},"website_media_spec":{"enroll_status":"OPT_OUT"},"website_summary_spec":{"enroll_status":"OPT_OUT"},"destination_screenshot_spec":{"enroll_status":"OPT_OUT"}}},

  STATIC_PAC: {"creative_features_spec":{"product_extensions":{"enroll_status":"OPT_OUT"},"adapt_to_placement":{"customizations":{"aspect_ratio_config":{}},"enroll_status":"OPT_OUT"},"add_text_overlay":{"enroll_status":"OPT_OUT"},"ads_with_benefits":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"advantage_plus_creative":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"app_highlights":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"audio":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"biz_ai":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"carousel_to_video":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"catalog_feed_tag":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"creative_stickers":{"enroll_status":"OPT_OUT"},"cv_transformation":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"description_automation":{"enroll_status":"OPT_OUT"},"dynamic_partner_content":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"enhance_cta":{"enroll_status":"OPT_OUT"},"feed_caption_optimization":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"generate_cta":{"enroll_status":"OPT_OUT"},"hide_price":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"ig_glados_feed":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"ig_video_native_subtitle":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"image_animation":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"image_auto_crop":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"image_background_gen":{"enroll_status":"OPT_OUT"},"image_brightness_and_contrast":{"enroll_status":"OPT_OUT"},"image_enhancement":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"image_templates":{"enroll_status":"OPT_OUT"},"image_text_translation":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"image_touchups":{"enroll_status":"OPT_OUT"},"image_uncrop":{"enroll_status":"OPT_OUT"},"inline_comment":{"enroll_status":"OPT_OUT"},"local_store_extension":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"media_liquidity_animated_image":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"media_order":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"media_type_automation":{"enroll_status":"OPT_OUT"},"multi_photo_to_video":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"pac_recomposition":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"pac_relaxation":{"enroll_status":"OPT_OUT"},"product_browsing":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"product_metadata_automation":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"profile_card":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"replace_media_text":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"reveal_details_over_time":{"enroll_status":"OPT_OUT"},"show_destination_blurbs":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"show_summary":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"site_extensions":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"standard_enhancements_catalog":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"text_optimizations":{"enroll_status":"OPT_OUT"},"text_translation":{"enroll_status":"OPT_OUT"},"translate_voiceover":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"video_auto_crop":{"enroll_status":"OPT_OUT"},"video_filtering":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"video_highlight":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"video_highlights":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"video_to_image":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"video_uncrop":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"wa_mm_image_filtering":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"enable_ncs_testimonials":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"dha_optimization":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"}},"creative_sourcing_spec":{"app_info_spec":{"enroll_status":"OPT_OUT"},"brand":{"enroll_status":"OPT_OUT"},"dynamic_site_links_spec":{"enroll_status":"OPT_OUT"},"featured_offering_spec":{"enroll_status":"OPT_OUT","media":[]},"website_media_spec":{"enroll_status":"OPT_OUT"},"website_summary_spec":{"enroll_status":"OPT_OUT"},"destination_screenshot_spec":{"enroll_status":"OPT_OUT"}}},

  VIDEO_NO_PAC: {"creative_features_spec":{"product_extensions":{"enroll_status":"OPT_OUT"},"adapt_to_placement":{"customizations":{"aspect_ratio_config":{}},"enroll_status":"OPT_OUT"},"add_text_overlay":{"enroll_status":"OPT_OUT"},"ads_with_benefits":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"advantage_plus_creative":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"app_highlights":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"audio":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"biz_ai":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"carousel_to_video":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"catalog_feed_tag":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"creative_stickers":{"enroll_status":"OPT_OUT"},"cv_transformation":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"description_automation":{"enroll_status":"OPT_OUT"},"dynamic_partner_content":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"enhance_cta":{"enroll_status":"OPT_OUT"},"feed_caption_optimization":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"generate_cta":{"enroll_status":"OPT_OUT"},"hide_price":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"ig_glados_feed":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"ig_video_native_subtitle":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"image_animation":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"image_auto_crop":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"image_background_gen":{"enroll_status":"OPT_OUT"},"image_brightness_and_contrast":{"enroll_status":"OPT_OUT"},"image_enhancement":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"image_templates":{"enroll_status":"OPT_OUT"},"image_text_translation":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"image_touchups":{"enroll_status":"OPT_OUT"},"image_uncrop":{"enroll_status":"OPT_OUT"},"inline_comment":{"enroll_status":"OPT_OUT"},"local_store_extension":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"media_liquidity_animated_image":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"media_order":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"media_type_automation":{"enroll_status":"OPT_OUT"},"multi_photo_to_video":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"pac_recomposition":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"pac_relaxation":{"enroll_status":"OPT_OUT"},"product_browsing":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"product_metadata_automation":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"profile_card":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"replace_media_text":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"reveal_details_over_time":{"enroll_status":"OPT_OUT"},"show_destination_blurbs":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"show_summary":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"site_extensions":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"standard_enhancements_catalog":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"text_optimizations":{"enroll_status":"OPT_OUT"},"text_translation":{"action_metadata":{"type":"MANUAL"},"enroll_status":"OPT_OUT"},"translate_voiceover":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"video_auto_crop":{"enroll_status":"OPT_OUT"},"video_filtering":{"enroll_status":"OPT_OUT"},"video_highlight":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"video_highlights":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"video_to_image":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"video_uncrop":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"wa_mm_image_filtering":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"enable_ncs_testimonials":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"dha_optimization":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"}},"creative_sourcing_spec":{"app_info_spec":{"enroll_status":"OPT_OUT"},"brand":{"enroll_status":"OPT_OUT"},"dynamic_site_links_spec":{"enroll_status":"OPT_OUT"},"featured_offering_spec":{"enroll_status":"OPT_OUT","media":[]},"website_media_spec":{"enroll_status":"OPT_OUT"},"website_summary_spec":{"enroll_status":"OPT_OUT"},"destination_screenshot_spec":{"enroll_status":"OPT_OUT"}}},

  VIDEO_PAC: {"creative_features_spec":{"product_extensions":{"enroll_status":"OPT_OUT"},"adapt_to_placement":{"customizations":{"aspect_ratio_config":{}},"enroll_status":"OPT_OUT"},"add_text_overlay":{"enroll_status":"OPT_OUT"},"ads_with_benefits":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"advantage_plus_creative":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"app_highlights":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"audio":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"biz_ai":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"carousel_to_video":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"catalog_feed_tag":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"creative_stickers":{"enroll_status":"OPT_OUT"},"cv_transformation":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"description_automation":{"enroll_status":"OPT_OUT"},"dynamic_partner_content":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"enhance_cta":{"enroll_status":"OPT_OUT"},"feed_caption_optimization":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"generate_cta":{"enroll_status":"OPT_OUT"},"hide_price":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"ig_glados_feed":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"ig_video_native_subtitle":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"image_animation":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"image_auto_crop":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"image_background_gen":{"enroll_status":"OPT_OUT"},"image_brightness_and_contrast":{"enroll_status":"OPT_OUT"},"image_enhancement":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"image_templates":{"enroll_status":"OPT_OUT"},"image_text_translation":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"image_touchups":{"enroll_status":"OPT_OUT"},"image_uncrop":{"enroll_status":"OPT_OUT"},"inline_comment":{"enroll_status":"OPT_OUT"},"local_store_extension":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"media_liquidity_animated_image":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"media_order":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"media_type_automation":{"enroll_status":"OPT_OUT"},"multi_photo_to_video":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"pac_recomposition":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"pac_relaxation":{"enroll_status":"OPT_OUT"},"product_browsing":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"product_metadata_automation":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"profile_card":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"replace_media_text":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"reveal_details_over_time":{"enroll_status":"OPT_OUT"},"show_destination_blurbs":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"show_summary":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"site_extensions":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"standard_enhancements_catalog":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"text_optimizations":{"enroll_status":"OPT_OUT"},"text_translation":{"enroll_status":"OPT_OUT"},"translate_voiceover":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"video_auto_crop":{"enroll_status":"OPT_OUT"},"video_filtering":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"video_highlight":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"video_highlights":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"video_to_image":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"video_uncrop":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"wa_mm_image_filtering":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"enable_ncs_testimonials":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"dha_optimization":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"}},"creative_sourcing_spec":{"app_info_spec":{"enroll_status":"OPT_OUT"},"brand":{"enroll_status":"OPT_OUT"},"dynamic_site_links_spec":{"enroll_status":"OPT_OUT"},"featured_offering_spec":{"enroll_status":"OPT_OUT","media":[]},"website_media_spec":{"enroll_status":"OPT_OUT"},"website_summary_spec":{"enroll_status":"OPT_OUT"},"destination_screenshot_spec":{"enroll_status":"OPT_OUT"}}},

  CAROUSEL: {"creative_features_spec":{"product_extensions":{"enroll_status":"OPT_OUT"},"adapt_to_placement":{"customizations":{"aspect_ratio_config":{}},"enroll_status":"OPT_OUT"},"add_text_overlay":{"enroll_status":"OPT_OUT"},"ads_with_benefits":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"advantage_plus_creative":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"app_highlights":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"audio":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"biz_ai":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"carousel_to_video":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"catalog_feed_tag":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"creative_stickers":{"enroll_status":"OPT_OUT"},"cv_transformation":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"description_automation":{"enroll_status":"OPT_OUT"},"dynamic_partner_content":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"enhance_cta":{"enroll_status":"OPT_OUT"},"feed_caption_optimization":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"generate_cta":{"enroll_status":"OPT_OUT"},"hide_price":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"ig_glados_feed":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"ig_video_native_subtitle":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"image_animation":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"image_auto_crop":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"image_background_gen":{"enroll_status":"OPT_OUT"},"image_brightness_and_contrast":{"enroll_status":"OPT_OUT"},"image_enhancement":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"image_templates":{"enroll_status":"OPT_OUT"},"image_text_translation":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"image_touchups":{"enroll_status":"OPT_OUT"},"image_uncrop":{"enroll_status":"OPT_OUT"},"inline_comment":{"enroll_status":"OPT_OUT"},"local_store_extension":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"media_liquidity_animated_image":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"media_order":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"media_type_automation":{"enroll_status":"OPT_OUT"},"multi_photo_to_video":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"pac_recomposition":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"pac_relaxation":{"enroll_status":"OPT_OUT"},"product_browsing":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"product_metadata_automation":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"profile_card":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"replace_media_text":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"reveal_details_over_time":{"enroll_status":"OPT_OUT"},"show_destination_blurbs":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"show_summary":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"site_extensions":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"standard_enhancements_catalog":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"text_optimizations":{"enroll_status":"OPT_OUT"},"text_translation":{"enroll_status":"OPT_OUT"},"translate_voiceover":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"video_auto_crop":{"enroll_status":"OPT_OUT"},"video_filtering":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"video_highlight":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"video_highlights":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"video_to_image":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"video_uncrop":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"wa_mm_image_filtering":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"enable_ncs_testimonials":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"},"dha_optimization":{"action_metadata":{"type":"DEFAULT_OFF"},"enroll_status":"OPT_OUT"}},"creative_sourcing_spec":{"app_info_spec":{"enroll_status":"OPT_OUT"},"brand":{"enroll_status":"OPT_OUT"},"dynamic_site_links_spec":{"enroll_status":"OPT_OUT"},"featured_offering_spec":{"enroll_status":"OPT_OUT","media":[]},"website_media_spec":{"enroll_status":"OPT_OUT"},"website_summary_spec":{"enroll_status":"OPT_OUT"},"destination_screenshot_spec":{"enroll_status":"OPT_OUT"}}},
};

// ═══════════════════════════════════════════════════════════════════════════════
// BATCH API UTILITY
// ═══════════════════════════════════════════════════════════════════════════════

interface BatchRequest {
  method: string;
  relative_url: string;
}

async function batchRequest(requests: BatchRequest[], accessToken: string): Promise<any[]> {
  const results: any[] = [];
  for (let i = 0; i < requests.length; i += BATCH_SIZE) {
    const chunk = requests.slice(i, i + BATCH_SIZE);
    const resp = await axios.post(BASE_URL, null, {
      params: {
        access_token: accessToken,
        batch: JSON.stringify(chunk),
        include_headers: "false",
      },
    });
    for (const item of resp.data) {
      if (item === null) {
        results.push({ error: "null response from batch" });
      } else if ((item.code || 200) >= 400) {
        const body = JSON.parse(item.body || "{}");
        results.push({ error: body.error?.message || `HTTP ${item.code}` });
      } else {
        results.push(JSON.parse(item.body || "{}"));
      }
    }
  }
  return results;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADS QA LOGIC
// ═══════════════════════════════════════════════════════════════════════════════

function determineFormatAndPac(creative: any): { format: string; isPac: boolean } {
  const assetFeed = creative?.asset_feed_spec || {};
  const objStory = creative?.object_story_spec || {};
  const linkData = objStory.link_data || {};

  if (linkData.child_attachments) return { format: "carousel", isPac: false };
  if (objStory.video_data) return { format: "video", isPac: false };
  if (assetFeed.videos) return { format: "video", isPac: true };
  if (assetFeed.images) return { format: "static", isPac: true };
  return { format: "static", isPac: false };
}

function getSpecKey(format: string, isPac: boolean): string {
  if (format === "carousel") return "CAROUSEL";
  if (format === "video") return isPac ? "VIDEO_PAC" : "VIDEO_NO_PAC";
  return isPac ? "STATIC_PAC" : "STATIC_NO_PAC";
}

function compareDof(actual: any, expected: any): string[] {
  if (!actual) return ["degrees_of_freedom_spec is MISSING entirely"];
  const violations: string[] = [];

  const actualFeatures = actual.creative_features_spec || {};
  const expectedFeatures = expected.creative_features_spec || {};

  // Check all fields in the expected spec
  for (const [name, expVal] of Object.entries<any>(expectedFeatures)) {
    const actVal = actualFeatures[name];
    if (!actVal) continue;
    if (actVal.enroll_status !== (expVal.enroll_status || "OPT_OUT")) {
      violations.push(`${name}: enroll_status=${actVal.enroll_status} (expected ${expVal.enroll_status || "OPT_OUT"})`);
    }
    // Also check nested customizations (e.g., text_optimizations.customizations.text_extraction)
    if (actVal.customizations && typeof actVal.customizations === 'object') {
      for (const [subName, subVal] of Object.entries<any>(actVal.customizations)) {
        if (subVal && subVal.enroll_status && subVal.enroll_status !== "OPT_OUT") {
          violations.push(`${name}.${subName}: enroll_status=${subVal.enroll_status} (expected OPT_OUT)`);
        }
      }
    }
  }

  // Check any fields present in actual but NOT in expected — they should all be OPT_OUT
  for (const [name, actVal] of Object.entries<any>(actualFeatures)) {
    if (!(name in expectedFeatures) && actVal.enroll_status !== "OPT_OUT") {
      violations.push(`${name}: enroll_status=${actVal.enroll_status} (unexpected, not OPT_OUT)`);
    }
    // Also check nested customizations for unexpected fields
    if (!(name in expectedFeatures) && actVal.customizations && typeof actVal.customizations === 'object') {
      for (const [subName, subVal] of Object.entries<any>(actVal.customizations)) {
        if (subVal && subVal.enroll_status && subVal.enroll_status !== "OPT_OUT") {
          violations.push(`${name}.${subName}: enroll_status=${subVal.enroll_status} (unexpected, not OPT_OUT)`);
        }
      }
    }
  }

  // Check for standard_enhancements (a top-level key Meta sometimes uses as a master toggle)
  if (actualFeatures.standard_enhancements && actualFeatures.standard_enhancements.enroll_status !== "OPT_OUT") {
    // Only add if not already caught above
    const alreadyCaught = violations.some(v => v.startsWith('standard_enhancements:'));
    if (!alreadyCaught) {
      violations.push(`standard_enhancements: enroll_status=${actualFeatures.standard_enhancements.enroll_status} (expected OPT_OUT)`);
    }
  }

  const actualSourcing = actual.creative_sourcing_spec || {};
  const expectedSourcing = expected.creative_sourcing_spec || {};
  for (const [name, expVal] of Object.entries<any>(expectedSourcing)) {
    const actVal = actualSourcing[name];
    if (!actVal) continue;
    if (actVal.enroll_status !== (expVal.enroll_status || "OPT_OUT")) {
      violations.push(`sourcing.${name}: enroll_status=${actVal.enroll_status} (expected ${expVal.enroll_status || "OPT_OUT"})`);
    }
  }

  return violations;
}

// Field extractors
function objStory(c: any) { return c?.object_story_spec || {}; }
function linkData(c: any) { return objStory(c).link_data || {}; }
function videoData(c: any) { return objStory(c).video_data || {}; }
function assetFeed(c: any) { return c?.asset_feed_spec || {}; }

function extractLandingPage(c: any): string {
  if (linkData(c).link) return linkData(c).link;
  if (videoData(c).call_to_action?.value?.link) return videoData(c).call_to_action.value.link;
  const links = assetFeed(c).link_urls || [];
  return links[0]?.website_url || "";
}

function extractUtms(url: string): string {
  try {
    const u = new URL(url);
    const utms: string[] = [];
    u.searchParams.forEach((v, k) => { if (k.startsWith("utm_")) utms.push(`${k}=${v}`); });
    return utms.join("\n");
  } catch { return ""; }
}

function extractHeadline(c: any): string {
  if (linkData(c).name) return linkData(c).name;
  if (videoData(c).title) return videoData(c).title;
  const titles = assetFeed(c).titles || [];
  return titles[0]?.text || "";
}

function extractPrimaryText(c: any): string {
  if (linkData(c).message) return linkData(c).message;
  if (videoData(c).message) return videoData(c).message;
  const bodies = assetFeed(c).bodies || [];
  return bodies[0]?.text || "";
}

function extractDescription(c: any): string {
  if (linkData(c).description) return linkData(c).description;
  const descs = assetFeed(c).descriptions || [];
  return descs[0]?.text || "";
}

function extractCta(c: any): { type: string; caption: string } {
  let ctaType = linkData(c).call_to_action?.type || videoData(c).call_to_action?.type || "";
  if (!ctaType) {
    const ctas = assetFeed(c).call_to_action_types || [];
    ctaType = typeof ctas[0] === "string" ? ctas[0] : "";
  }
  return { type: ctaType, caption: linkData(c).caption || "N/A" };
}

function extractFbPage(c: any): string {
  const pageId = objStory(c).page_id || "";
  return pageId ? `facebook.com/${pageId}` : "";
}

function extractPermalink(c: any): string {
  const storyId = c?.effective_object_story_id || "";
  if (storyId && storyId.includes("_")) {
    const [pageId, postId] = storyId.split("_", 2);
    return `facebook.com/${pageId}/posts/${postId}`;
  }
  return "";
}

function extractPixel(trackingSpecs: any[]): string {
  const ids: string[] = [];
  for (const spec of trackingSpecs || []) {
    if (spec.fb_pixel) ids.push(...spec.fb_pixel);
  }
  return ids.join(", ");
}

function checkPartnershipAd(c: any): string {
  const obj = objStory(c);
  return (obj.sponsor_id || obj.branded_content_sponsor_page_id) ? "On" : "Off";
}

interface AdsQaResult {
  rows: any[];
  violations: QaViolation[];
}

async function runAdsQaWithViolations(
  adIds: string[],
  accessToken: string,
  expectedPageId: string,
  adAccountId: string,
): Promise<AdsQaResult> {
  // Batch 1: fetch all ads
  const adFields = "name,status,effective_status,creative,tracking_specs,preview_shareable_link";
  const adBatch = adIds.map(id => ({ method: "GET", relative_url: `${id}?fields=${adFields}` }));
  const adResults = await batchRequest(adBatch, accessToken);
  const adsData: Record<string, any> = {};
  adIds.forEach((id, i) => { adsData[id] = adResults[i]; });

  // Collect creative IDs
  const creativeIds = Array.from(new Set(
    adIds
      .filter(id => !adsData[id]?.error && adsData[id]?.creative?.id)
      .map(id => adsData[id].creative.id)
  ));

  // Batch 2: fetch all creatives
  const creativeFields = "id,name,status,object_story_spec,asset_feed_spec,degrees_of_freedom_spec,url_tags,effective_object_story_id";
  const creativeBatch = creativeIds.map(id => ({ method: "GET", relative_url: `${id}?fields=${creativeFields}` }));
  const creativeResults = creativeIds.length ? await batchRequest(creativeBatch, accessToken) : [];
  const creativesData: Record<string, any> = {};
  creativeIds.forEach((id, i) => { creativesData[id] = creativeResults[i]; });

  // Batch 3: fetch multi-advertiser fields separately (these may not be readable on all creatives)
  // Kept separate so that if Meta returns errors for these fields, it doesn't break the main DOF detection
  const multiAdvFields = "contextual_multi_ads";
  const multiAdvBatch = creativeIds.map(id => ({ method: "GET", relative_url: `${id}?fields=${multiAdvFields}` }));
  const multiAdvResults = creativeIds.length ? await batchRequest(multiAdvBatch, accessToken).catch(() => []) : [];
  const multiAdvData: Record<string, any> = {};
  // Track which creative IDs had a Batch 3 error so we can write "Unknown" instead of "Off"
  const multiAdvError: Record<string, boolean> = {};
  creativeIds.forEach((id, i) => {
    const result = multiAdvResults[i];
    if (!result || result.error) {
      multiAdvData[id] = {};
      multiAdvError[id] = true;
    } else {
      multiAdvData[id] = result;
      multiAdvError[id] = false;
    }
  });

  // Build rows + structured violationss
  const rows: any[] = [];
  const violations: QaViolation[] = [];
  const cleanAccountId = adAccountId.replace(/^act_/, "");

  for (let idx = 0; idx < adIds.length; idx++) {
    const adId = adIds[idx];
    const ad = adsData[adId];
    if (ad?.error) {
      rows.push({
        "QA Complete": "", "Ad Name": `ERROR: ${ad.error}`, "Ad Status": "ERROR",
        "Link to Preview": "", "Creative #": String(idx + 1), "Creative Status": "",
        "Partnership Ad Turned Off": "", "Multi-Advertisers Unchecked": "",
        "Advantage Plus - Creative": "", "Correct FB Page Selected": "",
        "Headline": "", "Primary Text": "", "Description": "",
        "CTA - Type": "", "CTA - Link Caption": "", "Landing Page": "",
        "UTMs": "", "Permalink": "", "Applied Pixel(s)": "",
      });
      continue;
    }

    const creativeId = ad?.creative?.id || "";
    let c = creativeId ? (creativesData[creativeId] || {}) : {};
    if (c.error) c = {};

    const { format, isPac } = determineFormatAndPac(c);
    const specKey = getSpecKey(format, isPac);
    const dofViolations = compareDof(c.degrees_of_freedom_spec || {}, EXPECTED_SPECS[specKey]);

    // Check asset_feed_spec.audios — "Add Music" is enabled if audios is missing,
    // empty, or contains anything other than [{"type":"opted_out"}]
    const audios = c?.asset_feed_spec?.audios;
    if (audios && Array.isArray(audios)) {
      const hasOptedOut = audios.length === 1 && audios[0]?.type === "opted_out";
      if (!hasOptedOut && audios.length > 0) {
        dofViolations.push(`audio (asset_feed_spec.audios): ENABLED (expected opted_out)`);
      }
    }

    // ── Multi-advertiser check ───────────────────────────────────────────────
    // contextual_multi_ads is a top-level field on the creative (Batch 3).
    // Three-state: OPT_OUT → "Off", anything else → violation, missing → "Unknown"
    const maData = creativeId ? (multiAdvData[creativeId] || {}) : {};
    const maBatchError = creativeId ? (multiAdvError[creativeId] ?? true) : true;
    const multiAdsStatus: string | undefined = maData?.contextual_multi_ads?.enroll_status;
    console.log(`[QA] Ad ${ad.name || adId} | contextual_multi_ads:`, JSON.stringify(maData?.contextual_multi_ads), `| batchError:`, maBatchError);
    const multiAdsViolation = !!multiAdsStatus && multiAdsStatus !== "OPT_OUT";
    if (multiAdsViolation) {
      dofViolations.push(`contextual_multi_ads: enroll_status=${multiAdsStatus} (expected OPT_OUT)`);
    }
    let multiAdsExcelValue: string;
    if (multiAdsStatus === "OPT_OUT") {
      multiAdsExcelValue = "Off";
    } else if (multiAdsViolation) {
      multiAdsExcelValue = `ON — VIOLATION (${multiAdsStatus})`;
    } else {
      multiAdsExcelValue = "Unknown";
    }


    const advPlus = dofViolations.length
      ? "SETTINGS STILL ON:\n" + dofViolations.map(v => `\u2022 ${v}`).join("\n")
      : "N/A";

    // Build structured violations for the UI
    if (dofViolations.length > 0 && creativeId) {
      const settings = dofViolations.map(v => {
        // Parse "feature_name: enroll_status=OPT_IN (expected OPT_OUT)"
        const match = v.match(/^(.+?):\s*enroll_status=(\S+)\s*\(expected\s+(\S+)\)/);
        if (match) {
          return { name: match[1], currentValue: match[2], expectedValue: match[3] };
        }
        // Parse "feature_name: enroll_status=OPT_IN (unexpected, not OPT_OUT)"
        const match2 = v.match(/^(.+?):\s*enroll_status=(\S+)\s*\(unexpected/);
        if (match2) {
          return { name: match2[1], currentValue: match2[2], expectedValue: "OPT_OUT" };
        }
        // Parse Add Music violation: "audio (asset_feed_spec.audios): ENABLED (expected opted_out)"
        const audioMatch = v.match(/^audio \(asset_feed_spec\.audios\):\s*(\S+)\s*\(expected\s+(\S+)\)/);
        if (audioMatch) {
          return { name: "Add Music (asset_feed_spec.audios)", currentValue: audioMatch[1], expectedValue: audioMatch[2] };
        }
        // Parse multi_advertiser_eligibility: "multi_advertiser_eligibility: ELIGIBLE (expected INELIGIBLE)"
        const multiAdvMatch = v.match(/^multi_advertiser_eligibility:\s*(\S+)\s*\(expected\s+(\S+)\)/);
        if (multiAdvMatch) {
          return { name: "Multi-Advertiser Eligibility", currentValue: multiAdvMatch[1], expectedValue: multiAdvMatch[2] };
        }
        // Fallback for "degrees_of_freedom_spec is MISSING entirely"
        return { name: v, currentValue: "MISSING", expectedValue: "OPT_OUT" };
      });

      violations.push({
        adId,
        adName: ad.name || adId,
        creativeId,
        specKey,
        settings,
        adsManagerUrl: `https://www.facebook.com/adsmanager/manage/ads?act=${cleanAccountId}&selected_ad_ids=${adId}`,
      });
    }

    const fbPage = extractFbPage(c);
    const correctPage = expectedPageId
      ? (fbPage.includes(expectedPageId) ? fbPage : `MISMATCH: ${fbPage}`)
      : fbPage;

    let landingPage = extractLandingPage(c);
    const urlTags = c.url_tags || "";
    if (urlTags && landingPage) {
      const sep = landingPage.includes("?") ? "&" : "?";
      landingPage = `${landingPage}${sep}${urlTags}`;
    }
    const formatDisplay = format === "static" ? "Static Image" : format.charAt(0).toUpperCase() + format.slice(1);
    const cta = extractCta(c);

    rows.push({
      "QA Complete": "",
      "Ad Name": `${ad.name || ""} | ${formatDisplay}`,
      "Ad Status": ad.effective_status || ad.status || "",
      "Link to Preview": ad.preview_shareable_link || "",
      "Creative #": String(idx + 1),
      "Creative Status": c.status || "",
      "Partnership Ad Turned Off": checkPartnershipAd(c),
      "Multi-Advertisers Unchecked": multiAdsExcelValue,
      "Advantage Plus - Creative": advPlus,
      "Correct FB Page Selected": correctPage,
      "Headline": extractHeadline(c),
      "Primary Text": extractPrimaryText(c),
      "Description": extractDescription(c),
      "CTA - Type": cta.type,
      "CTA - Link Caption": cta.caption,
      "Landing Page": landingPage,
      "Permalink": extractPermalink(c),
      "Applied Pixel(s)": extractPixel(ad.tracking_specs || []),
    });
  }
  return { rows, violations };
}

// ═══════════════════════════════════════════════════════════════════════════════
// AD SETS QA LOGIC
// ═══════════════════════════════════════════════════════════════════════════════

function formatGeo(targeting: any): string {
  const geo = targeting?.geo_locations || {};
  const lines: string[] = [];

  for (const country of geo.countries || []) lines.push(country);
  for (const region of geo.regions || []) {
    const name = region.name || "";
    const country = region.country || "";
    lines.push(country && country !== "US" ? `${name}, ${country}` : name);
  }
  for (const city of geo.cities || []) {
    const cityName = city.name || "";
    const region = city.region || "";
    const country = city.country || "US";
    const radius = city.radius || 0;
    const radiusUnit = city.distance_unit || "mile";
    let label = country === "US" && region ? `${cityName}, ${region}` : country !== "US" ? `${cityName}, ${country}` : cityName;
    if (radius && Number(radius) > 0) {
      const unitShort = radiusUnit.includes("mile") ? "mi" : "km";
      label += ` (+${radius} ${unitShort})`;
    }
    lines.push(label);
  }
  for (const dma of geo.geo_markets || []) lines.push(dma.name || "");
  for (const zc of geo.zips || []) lines.push(zc.name || zc.key || "");

  return lines.length ? lines.join("\n") : "All";
}

function formatPlacements(targeting: any): string {
  const platformPositions: Record<string, string[]> = {
    facebook: targeting?.facebook_positions || [],
    instagram: targeting?.instagram_positions || [],
    audience_network: targeting?.audience_network_positions || [],
    messenger: targeting?.messenger_positions || [],
  };
  const publisherPlatforms: string[] = targeting?.publisher_platforms || [];
  const lines: string[] = [];

  for (const platform of publisherPlatforms) {
    const positions = platformPositions[platform] || [];
    lines.push(positions.length ? `${platform}: ${positions.join(", ")}` : platform);
  }
  for (const [platform, positions] of Object.entries(platformPositions)) {
    if (!publisherPlatforms.includes(platform) && positions.length) {
      lines.push(`${platform}: ${positions.join(", ")}`);
    }
  }
  return lines.length ? lines.join("\n") : "Automatic";
}

function formatAgeGender(targeting: any): { age: string; gender: string } {
  const ageMin = targeting?.age_min || 18;
  const ageMax = targeting?.age_max || 65;
  const genders: number[] = targeting?.genders || [];
  const genderMap: Record<number, string> = { 1: "Male", 2: "Female" };
  return {
    age: `Min: ${ageMin}\nMax: ${ageMax}`,
    gender: genders.length ? genders.map(g => genderMap[g] || String(g)).join(", ") : "All",
  };
}

function formatDetailedTargeting(targeting: any): string {
  const lines: string[] = [];
  for (const specGroup of targeting?.flexible_spec || []) {
    for (const [category, items] of Object.entries<any>(specGroup)) {
      const catLabel = category.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
      const names = items.map((item: any) => typeof item === "object" ? (item.name || JSON.stringify(item)) : String(item));
      lines.push(`${catLabel}: ${names.join(", ")}`);
    }
  }
  const exclusions = targeting?.exclusions || {};
  for (const [category, items] of Object.entries<any>(exclusions)) {
    const catLabel = category.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
    const names = items.map((item: any) => typeof item === "object" ? (item.name || JSON.stringify(item)) : String(item));
    lines.push(`EXCLUDE ${catLabel}: ${names.join(", ")}`);
  }
  return lines.join("\n");
}

function formatBrowserAdOns(targeting: any): string {
  const devicePlatforms: string[] = targeting?.device_platforms || [];
  if (devicePlatforms.length) return devicePlatforms.join(", ");
  const fbPos: string[] = targeting?.facebook_positions || [];
  const igPos: string[] = targeting?.instagram_positions || [];
  const desktopCapable = new Set(["feed", "facebook_reels", "right_hand_column", "marketplace", "search"]);
  const mobileOnly = new Set(["story", "reels", "stream", "explore", "instagram_explore_grid_home"]);
  const allPos = [...fbPos, ...igPos];
  const hasDesktop = allPos.some(p => desktopCapable.has(p));
  const hasMobile = allPos.some(p => mobileOnly.has(p)) || igPos.length > 0;
  if (hasDesktop && hasMobile) return "mobile, desktop";
  if (hasDesktop) return "desktop";
  if (hasMobile) return "mobile";
  return "";
}

function formatBudget(adset: any): string {
  const daily = parseInt(adset.daily_budget || "0", 10);
  const lifetime = parseInt(adset.lifetime_budget || "0", 10);
  if (daily > 0) return `$${(daily / 100).toFixed(2)}/day`;
  if (lifetime > 0) return `$${(lifetime / 100).toFixed(2)} lifetime`;
  return "";
}

function formatDatetime(dt: string): string {
  if (!dt) return "";
  const m = dt.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  return m ? `${m[1]} ${m[2]}` : dt;
}

async function runAdsetsQa(adIds: string[], accessToken: string): Promise<any[]> {
  // Batch 3: fetch adset_id for each ad
  const adsetIdBatch = adIds.map(id => ({ method: "GET", relative_url: `${id}?fields=adset_id` }));
  const adsetIdResults = await batchRequest(adsetIdBatch, accessToken);
  const adsetIdMap: Record<string, string> = {};
  adIds.forEach((id, i) => {
    adsetIdMap[id] = adsetIdResults[i]?.error ? "" : (adsetIdResults[i]?.adset_id || "");
  });

  const uniqueAdsetIds = Array.from(new Set(Object.values(adsetIdMap).filter(Boolean)));
  if (!uniqueAdsetIds.length) return [];

  // Batch 4: fetch full ad set data
  const adsetFields = "name,status,effective_status,start_time,end_time,daily_budget,lifetime_budget,optimization_goal,targeting";
  const adsetBatch = uniqueAdsetIds.map(id => ({ method: "GET", relative_url: `${id}?fields=${adsetFields}` }));
  const adsetResults = await batchRequest(adsetBatch, accessToken);
  const adsetsData: Record<string, any> = {};
  uniqueAdsetIds.forEach((id, i) => { adsetsData[id] = adsetResults[i]; });

  // Build rows (deduplicated)
  const rows: any[] = [];
  const seen = new Set<string>();
  for (const adId of adIds) {
    const asid = adsetIdMap[adId] || "";
    if (!asid || seen.has(asid)) continue;
    seen.add(asid);
    const adset = adsetsData[asid] || {};
    if (adset.error) {
      rows.push({
        "QA Complete": "", "Notes": "",
        "Ad Set Name": `ERROR: ${adset.error}`,
        "Status": "ERROR", "Start Time": "", "End Time": "",
        "Ad Set Budget": "", "Optimization Type": "",
        "Geo": "", "Placements": "", "Age": "", "Gender": "",
        "Audience (Detailed Targeting)": "", "Browser Ad Ons": "",
      });
      continue;
    }

    const targeting = adset.targeting || {};
    const { age, gender } = formatAgeGender(targeting);

    rows.push({
      "QA Complete": "",
      "Notes": "",
      "Ad Set Name": adset.name || "",
      "Status": adset.effective_status || adset.status || "",
      "Start Time": formatDatetime(adset.start_time || ""),
      "End Time": formatDatetime(adset.end_time || ""),
      "Ad Set Budget": formatBudget(adset),
      "Optimization Type": adset.optimization_goal || "",
      "Geo": formatGeo(targeting),
      "Placements": formatPlacements(targeting),
      "Age": age,
      "Gender": gender,
      "Audience (Detailed Targeting)": formatDetailedTargeting(targeting),
      "Browser Ad Ons": formatBrowserAdOns(targeting),
    });
  }
  return rows;
}

// ═══════════════════════════════════════════════════════════════════════════════
// XLSX GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

async function generateXlsx(adRows: any[], adsetRows: any[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();

  // Tab 1: Ad QA Checklist
  const AD_COLUMNS = [
    "QA Complete", "Ad Name", "Ad Status", "Link to Preview",
    "Creative #", "Creative Status",
    "Partnership Ad Turned Off", "Multi-Advertisers Unchecked",
    "Advantage Plus - Creative", "Correct FB Page Selected",
    "Headline", "Primary Text", "Description",
    "CTA - Type", "CTA - Link Caption",
    "Landing Page", "UTMs", "Permalink", "Applied Pixel(s)",
  ];
  const AD_COL_WIDTHS = [12, 40, 12, 30, 12, 16, 24, 24, 50, 25, 35, 50, 30, 15, 18, 60, 35, 40, 25];

  const ws1 = wb.addWorksheet("Ad QA Checklist");
  writeTab(ws1, "Ad QA Checklist", AD_COLUMNS, adRows, AD_COL_WIDTHS, 7, 13);

  // Tab 2: Ad Sets
  const ADSET_COLUMNS = [
    "QA Complete", "Notes", "Ad Set Name", "Status",
    "Start Time", "End Time", "Ad Set Budget", "Optimization Type",
    "Geo", "Placements", "Age", "Gender",
    "Audience (Detailed Targeting)", "Browser Ad Ons",
  ];
  const ADSET_COL_WIDTHS = [12, 18, 38, 12, 18, 18, 18, 20, 30, 40, 14, 12, 45, 18];

  const ws2 = wb.addWorksheet("Ad Sets");
  writeTab(ws2, "Ad Sets", ADSET_COLUMNS, adsetRows, ADSET_COL_WIDTHS, 3, 14);

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function writeTab(
  ws: ExcelJS.Worksheet,
  title: string,
  columns: string[],
  rows: any[],
  colWidths: number[],
  titleStartCol: number,
  titleEndCol: number,
) {
  // Title banner (row 1)
  ws.mergeCells(1, titleStartCol, 1, titleEndCol);
  const titleCell = ws.getCell(1, titleStartCol);
  titleCell.value = title;
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2D6E" } };
  titleCell.font = { name: "Calibri", bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 22;

  // Header row (row 2)
  const headerRow = ws.getRow(2);
  columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5C518" } };
    cell.font = { name: "Calibri", bold: true, size: 10 };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = thinBorder();
  });
  ws.getRow(2).height = 30;

  // Data rows (starting row 3)
  rows.forEach((rowData, rowIdx) => {
    const excelRow = ws.getRow(rowIdx + 3);
    const fillColor = rowIdx % 2 === 0 ? "FFFFFDE7" : "FFFFFFFF";
    columns.forEach((col, colIdx) => {
      const cell = excelRow.getCell(colIdx + 1);
      cell.value = rowData[col] || "";
      cell.font = { name: "Calibri", size: 10 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillColor } };
      cell.border = thinBorder();
      cell.alignment = { vertical: "top", wrapText: true };
    });
  });

  // Column widths
  colWidths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  // Freeze header rows
  ws.views = [{ state: "frozen", xSplit: 0, ySplit: 2 }];
}

function thinBorder(): Partial<ExcelJS.Borders> {
  return {
    top: { style: "thin" },
    bottom: { style: "thin" },
    left: { style: "thin" },
    right: { style: "thin" },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════════

export interface QaChecklistParams {
  adIds: string[];
  accessToken: string;
  adAccountId: string;
  facebookPageId?: string;
}

export interface QaViolation {
  adId: string;
  adName: string;
  creativeId: string;
  specKey: string;
  settings: Array<{ name: string; currentValue: string; expectedValue: string }>;
  adsManagerUrl: string;
}

export interface QaChecklistResult {
  downloadUrl: string;
  totalAds: number;
  totalAdSets: number;
  violationCount: number;
  violations: QaViolation[];
}

export async function runQaChecklist(params: QaChecklistParams): Promise<QaChecklistResult> {
  const { adIds, accessToken, adAccountId, facebookPageId } = params;

  // Run both QA modules (4 batch API calls total)
  const [adsQaResult, adsetRows] = await Promise.all([
    runAdsQaWithViolations(adIds, accessToken, facebookPageId || "", adAccountId),
    runAdsetsQa(adIds, accessToken),
  ]);

  const { rows: adRows, violations } = adsQaResult;

  // Generate XLSX
  const xlsxBuffer = await generateXlsx(adRows, adsetRows);

  // Upload to S3
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `qa-checklist/ad_qa_checklist_${timestamp}.xlsx`;
  const { url } = await storagePut(
    filename,
    xlsxBuffer,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );

  return {
    downloadUrl: url,
    totalAds: adRows.length,
    totalAdSets: adsetRows.length,
    violationCount: violations.length,
    violations,
  };
}

/**
 * Get the correct EXPECTED_SPECS for a given spec key.
 * Used by the fix endpoint to know what to send to Meta.
 */
export function getExpectedSpec(specKey: string): any {
  return EXPECTED_SPECS[specKey] || EXPECTED_SPECS["STATIC_NO_PAC"];
}

/**
 * Build the FULL DOF spec that Meta accepts for writing — all settings OFF.
 * This matches the exact payload structure observed from Meta when all Advantage+
 * creative settings are turned off for a static image ad.
 */
function buildWritableDofSpec(_specKey: string): Record<string, unknown> {
  const off = { enroll_status: "OPT_OUT" };
  const defaultOff = { action_metadata: { type: "DEFAULT_OFF" }, enroll_status: "OPT_OUT" };

  return {
    creative_features_spec: {
      product_extensions:              off,
      adapt_to_placement:              { customizations: { aspect_ratio_config: {} }, enroll_status: "OPT_OUT" },
      add_text_overlay:                off,
      ads_with_benefits:               defaultOff,
      advantage_plus_creative:         defaultOff,
      app_highlights:                  defaultOff,
      audio:                           defaultOff,
      biz_ai:                          defaultOff,
      carousel_to_video:               defaultOff,
      catalog_feed_tag:                defaultOff,
      creative_stickers:               off,
      cv_transformation:               defaultOff,
      description_automation:          off,
      dynamic_partner_content:         defaultOff,
      enhance_cta:                     off,
      feed_caption_optimization:       defaultOff,
      generate_cta:                    off,
      hide_price:                      defaultOff,
      ig_glados_feed:                  defaultOff,
      ig_video_native_subtitle:        defaultOff,
      image_animation:                 defaultOff,
      image_auto_crop:                 defaultOff,
      image_background_gen:            off,
      image_brightness_and_contrast:   off,
      image_enhancement:               defaultOff,
      image_templates:                 off,
      image_text_translation:          defaultOff,
      image_touchups:                  off,
      image_uncrop:                    off,
      inline_comment:                  off,
      local_store_extension:           defaultOff,
      media_liquidity_animated_image:  defaultOff,
      media_order:                     defaultOff,
      media_type_automation:           off,
      multi_photo_to_video:            defaultOff,
      pac_recomposition:               defaultOff,
      pac_relaxation:                  off,
      product_browsing:                defaultOff,
      product_metadata_automation:     defaultOff,
      profile_card:                    defaultOff,
      replace_media_text:              defaultOff,
      reveal_details_over_time:        off,
      show_destination_blurbs:         defaultOff,
      show_summary:                    defaultOff,
      site_extensions:                 defaultOff,
      standard_enhancements_catalog:   defaultOff,
      text_optimizations:              off,
      text_translation:                { action_metadata: { type: "MANUAL" }, enroll_status: "OPT_OUT" },
      translate_voiceover:             defaultOff,
      video_auto_crop:                 off,
      video_filtering:                 defaultOff,
      video_highlight:                 defaultOff,
      video_highlights:                defaultOff,
      video_to_image:                  defaultOff,
      video_uncrop:                    defaultOff,
      wa_mm_image_filtering:           defaultOff,
      enable_ncs_testimonials:         defaultOff,
      dha_optimization:                defaultOff,
    },
    // NOTE: creative_sourcing_spec is intentionally omitted here.
    // Meta's API rejects it with "Unexpected key creative_sourcing_spec on param degrees_of_freedom_spec"
    // when updating via POST /{adId} with the creative param.
  };
}

/**
 * Fix an ad's DOF spec by creating a NEW creative with corrected degrees_of_freedom_spec
 * and reassigning the ad to use the new creative.
 *
 * Three-step approach (same pattern as the campaign builder's ad creation flow):
 * 1. Fetch the existing creative's object_story_spec + url_tags from Meta
 * 2. Create a NEW creative under the ad account with the same content + corrected DOF spec
 * 3. Update the ad to point to the new creative ID
 *
 * This avoids the shared-creative problem (multiple ads using the same creative)
 * and ensures Meta actually persists the DOF changes (unlike the creative_id + DOF approach
 * which Meta silently ignores).
 */
export async function fixAdDofSpec(params: {
  adId: string;
  creativeId: string;
  specKey: string;
  accessToken: string;
}): Promise<{ success: boolean; error?: string; debug?: { url: string; body: unknown; response?: unknown } }> {
  const { adId, creativeId, specKey, accessToken } = params;

  const dofSpec = buildFullDofSpec(specKey);

  try {
    // Step 1: Fetch the ad's account_id and existing creative content
    console.log("[fixAdDofSpec] Step 1: Fetching ad", adId, "for account_id");
    const adResp = await axios.get(`${BASE_URL}/${adId}`, {
      params: { fields: "account_id", access_token: accessToken },
      timeout: 30000,
    });
    const accountId = adResp.data.account_id;
    if (!accountId) {
      return {
        success: false,
        error: "Could not fetch account_id from ad.",
        debug: { url: `${BASE_URL}/${adId}`, body: { fields: "account_id" }, response: adResp.data },
      };
    }
    console.log("[fixAdDofSpec] Account ID:", accountId);

    // Fetch existing creative content
    const fieldsToFetch = "object_story_spec,url_tags,name,asset_feed_spec";
    console.log("[fixAdDofSpec] Fetching creative", creativeId, "fields:", fieldsToFetch);
    const creativeResp = await axios.get(`${BASE_URL}/${creativeId}`, {
      params: { fields: fieldsToFetch, access_token: accessToken },
      timeout: 30000,
    });
    const existingCreative = creativeResp.data;
    console.log("[fixAdDofSpec] Existing creative:", JSON.stringify({
      id: existingCreative.id,
      hasObjectStorySpec: !!existingCreative.object_story_spec,
      hasUrlTags: !!existingCreative.url_tags,
      hasAssetFeedSpec: !!existingCreative.asset_feed_spec,
      name: existingCreative.name,
    }));

    if (!existingCreative.object_story_spec) {
      return {
        success: false,
        error: "Could not fetch object_story_spec from existing creative. Cannot create replacement.",
        debug: { url: `${BASE_URL}/${creativeId}`, body: { fields: fieldsToFetch }, response: existingCreative },
      };
    }

    // Step 2: Create a NEW creative under the ad account with corrected DOF spec
    const newCreativePayload: Record<string, unknown> = {
      name: existingCreative.name ? `${existingCreative.name} (DOF fixed)` : `Creative ${creativeId} (DOF fixed)`,
      object_story_spec: existingCreative.object_story_spec,
      degrees_of_freedom_spec: dofSpec,
      contextual_multi_ads: { enroll_status: "OPT_OUT" },
      multi_advertiser_eligibility: "INELIGIBLE",
    };

    // Preserve url_tags if present
    if (existingCreative.url_tags) {
      newCreativePayload.url_tags = existingCreative.url_tags;
    }

    // Fix asset_feed_spec.audios to turn off "Add Music"
    if (existingCreative.asset_feed_spec) {
      newCreativePayload.asset_feed_spec = {
        ...existingCreative.asset_feed_spec,
        audios: [{ type: "opted_out" }],
      };
    }

    const createUrl = `${BASE_URL}/act_${accountId}/adcreatives`;
    console.log("[fixAdDofSpec] Step 2: Creating new creative at:", createUrl);
    console.log("[fixAdDofSpec] DOF spec keys:", Object.keys(dofSpec));
    console.log("[fixAdDofSpec] creative_features_spec field count:", Object.keys((dofSpec as any).creative_features_spec || {}).length);

    const createResp = await axios.post(createUrl, {
      ...newCreativePayload,
      access_token: accessToken,
    }, { timeout: 60000 });

    const newCreativeId = createResp.data?.id;
    if (!newCreativeId) {
      return {
        success: false,
        error: "Meta did not return a new creative ID.",
        debug: { url: createUrl, body: { ...newCreativePayload, access_token: "[REDACTED]" }, response: createResp.data },
      };
    }
    console.log("[fixAdDofSpec] New creative created:", newCreativeId);

    // Step 3: Update the ad to point to the new creative
    const updateAdUrl = `${BASE_URL}/${adId}`;
    console.log("[fixAdDofSpec] Step 3: Updating ad", adId, "to use new creative", newCreativeId);
    const updateResp = await axios.post(updateAdUrl, {
      creative: JSON.stringify({ creative_id: newCreativeId }),
      access_token: accessToken,
    }, { timeout: 60000 });
    console.log("[fixAdDofSpec] Ad update response:", JSON.stringify(updateResp.data));

    return {
      success: true,
      debug: {
        url: updateAdUrl,
        body: {
          step1: "Fetched creative content",
          step2: `Created new creative ${newCreativeId} at ${createUrl}`,
          step3: `Updated ad ${adId} to use creative ${newCreativeId}`,
          newCreativeId,
        },
        response: updateResp.data,
      },
    };
  } catch (err: any) {
    const metaError = err?.response?.data?.error;
    const metaMsg = metaError?.message
      || metaError?.error_user_msg
      || (err instanceof Error ? err.message : String(err));
    console.error("[fixAdDofSpec] FAILED:", JSON.stringify(metaError || err?.response?.data || err?.message));
    return {
      success: false,
      error: metaMsg,
      debug: {
        url: `${BASE_URL}/${adId}`,
        body: { degrees_of_freedom_spec: dofSpec, access_token: "[REDACTED]" },
        response: metaError || err?.response?.data,
      },
    };
  }
}

/**
 * Full DOF spec matching ads_qa.py EXPECTED_SPECS.
 * Includes all ~55 creative_features_spec fields with action_metadata wrappers
 * AND creative_sourcing_spec. This is what Meta expects when updating via the ad ID.
 */
function buildFullDofSpec(specKey: string): Record<string, unknown> {
  const off = { enroll_status: "OPT_OUT" };
  const offWithMeta = { action_metadata: { type: "DEFAULT_OFF" }, enroll_status: "OPT_OUT" };
  const offManual = { action_metadata: { type: "MANUAL" }, enroll_status: "OPT_OUT" };

  // creative_features_spec — all fields from ads_qa.py EXPECTED_SPECS
  const creative_features_spec: Record<string, unknown> = {
    product_extensions: off,
    adapt_to_placement: { customizations: { aspect_ratio_config: {} }, enroll_status: "OPT_OUT" },
    add_text_overlay: off,
    ads_with_benefits: offWithMeta,
    advantage_plus_creative: offWithMeta,
    app_highlights: offWithMeta,
    audio: offWithMeta,
    biz_ai: offWithMeta,
    carousel_to_video: offWithMeta,
    catalog_feed_tag: offWithMeta,
    creative_stickers: off,
    cv_transformation: offWithMeta,
    description_automation: off,
    dynamic_partner_content: offWithMeta,
    enhance_cta: off,
    feed_caption_optimization: offWithMeta,
    generate_cta: off,
    hide_price: offWithMeta,
    ig_glados_feed: offWithMeta,
    ig_video_native_subtitle: offWithMeta,
    image_animation: offWithMeta,
    image_auto_crop: offWithMeta,
    image_background_gen: off,
    image_brightness_and_contrast: off,
    image_enhancement: offWithMeta,
    image_templates: off,
    image_text_translation: offWithMeta,
    image_touchups: off,
    image_uncrop: off,
    inline_comment: off,
    local_store_extension: offWithMeta,
    media_liquidity_animated_image: offWithMeta,
    media_order: offWithMeta,
    media_type_automation: off,
    multi_photo_to_video: offWithMeta,
    pac_recomposition: offWithMeta,
    pac_relaxation: off,
    product_browsing: offWithMeta,
    product_metadata_automation: offWithMeta,
    profile_card: offWithMeta,
    replace_media_text: offWithMeta,
    reveal_details_over_time: off,
    show_destination_blurbs: offWithMeta,
    show_summary: offWithMeta,
    site_extensions: offWithMeta,
    standard_enhancements_catalog: offWithMeta,
    text_optimizations: off,
    // text_translation differs by spec: NO_PAC has action_metadata MANUAL, PAC has plain off
    text_translation: specKey.includes("PAC") && !specKey.includes("NO_PAC") ? off : offManual,
    translate_voiceover: offWithMeta,
    video_auto_crop: off,
    video_filtering: offWithMeta,
    video_highlight: offWithMeta,
    video_highlights: offWithMeta,
    video_to_image: offWithMeta,
    video_uncrop: offWithMeta,
    wa_mm_image_filtering: offWithMeta,
    enable_ncs_testimonials: offWithMeta,
    dha_optimization: offWithMeta,
  };

  // creative_sourcing_spec — from ads_qa.py
  const creative_sourcing_spec: Record<string, unknown> = {
    app_info_spec: off,
    brand: off,
    dynamic_site_links_spec: off,
    featured_offering_spec: { enroll_status: "OPT_OUT", media: [] },
    website_media_spec: off,
    website_summary_spec: off,
    destination_screenshot_spec: off,
  };

  // NOTE: creative_sourcing_spec is NOT accepted by Meta's API when updating via
  // the ad ID or creative ID — it throws "Unexpected key creative_sourcing_spec".
  // Only creative_features_spec is writable.
  return {
    creative_features_spec,
  };
}

/**
 * Fix multi-advertiser violations in-place on the existing creative.
 * Unlike fixAdDofSpec, this does NOT create a new creative — it directly
 * updates contextual_multi_ads and asset_feed_spec.multi_advertiser_eligibility
 * on the existing creative ID, preserving the creative ID for all linked ads.
 */
export async function fixMultiAdvertiserOnly(params: {
  creativeId: string;
  accessToken: string;
  creativeName?: string;
}): Promise<{ success: boolean; error?: string; debug?: unknown }> {
  const { creativeId, accessToken, creativeName } = params;

  try {
    const url = `${BASE_URL}/${creativeId}`;
    console.log("[fixMultiAdv] Updating contextual_multi_ads on creative", creativeId);
    
    // First, fetch the current creative to get its status
    console.log("[fixMultiAdv] Fetching current creative status...");
    const getResp = await axios.get(url, {
      params: { access_token: accessToken, fields: "status" },
      timeout: 30000,
    });
    const currentStatus = getResp.data?.status;
    console.log("[fixMultiAdv] Current status:", currentStatus);

    // contextual_multi_ads must include action_metadata with type MANUAL when setting to OPT_OUT
    // Include the current status to satisfy Meta's requirement for at least one of: name, status, or associated_adlabels
    const payload: any = {
      contextual_multi_ads: { 
        action_metadata: { type: "MANUAL" },
        enroll_status: "OPT_OUT" 
      },
      access_token: accessToken,
    };
    
    // Include status if we have it (even if unchanged, it satisfies the requirement)
    if (currentStatus) {
      payload.status = currentStatus;
    }
    
    const resp = await axios.post(url, payload, { timeout: 30000 });
    console.log("[fixMultiAdv] Response:", JSON.stringify(resp.data));

    return { success: true, debug: { url, response: resp.data } };
  } catch (err: any) {
    const metaError = err?.response?.data?.error;
    const msg = metaError?.message || metaError?.error_user_msg || (err instanceof Error ? err.message : String(err));
    console.error("[fixMultiAdv] FAILED:", JSON.stringify(metaError || err?.response?.data || err?.message));
    return { success: false, error: msg, debug: metaError || err?.response?.data };
  }
}
