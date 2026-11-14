// The URL slug of the manage-family Edge Function (supabase/functions/manage-family) as
// deployed. The dashboard names it "manage-family", but its URL is /functions/v1/dynamic-api,
// and calls go to the URL. If the function is redeployed under another slug, change it here.
export const MANAGE_FAMILY_FUNCTION = 'dynamic-api';

// The URL slug of the generate-questions Edge Function (supabase/functions/generate-questions) as
// deployed: the dashboard editor named its URL /functions/v1/clever-service. If it is redeployed
// under another slug, change it here.
export const GENERATE_QUESTIONS_FUNCTION = 'clever-service';

// The URL slug of the pair-phone Edge Function (supabase/functions/pair-phone) as deployed: the
// dashboard editor named its URL /functions/v1/hyper-function. If it is redeployed under another
// slug, change it here.
export const PAIR_PHONE_FUNCTION = 'hyper-function';
