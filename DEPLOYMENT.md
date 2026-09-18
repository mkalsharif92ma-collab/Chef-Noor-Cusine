# Chef Noor Cuisine — Final Update

## Included
- Admin-controlled website settings: phone, WhatsApp, Instagram, Facebook, slogan.
- Admin-controlled hero/circle/story/CTA/footer image URLs.
- Daily meal images remain editable from Admin > الوجبات.
- Subscription and daily meals both go to the cart before final confirmation.
- Cart clearly asks the customer to confirm from the shopping cart.
- Daily cart items keep their own order date, so today/tomorrow items do not merge.
- Daily delivery fee is configurable from Admin > إعدادات الموقع (default 1 JOD).
- Subscribers select the next working day; Friday/Thursday holiday logic skips Friday.
- Tomorrow's menu is never auto-published by the planner.
- Admin controls menu display window from Admin > إعدادات الموقع.
- Top slogan/contact strip appears above the main header.

## Supabase
Run `supabase/chef_noor_final_migration.sql` once in Supabase SQL Editor.
The SQL is additive and includes verification queries.

## Deploy
npm install
npm run build
npm run preview

Then commit/push to GitHub and deploy on Vercel.
