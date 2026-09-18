# Chef Noor Cuisine — Production V5

This release wires the admin Site Settings screen to the real application state, so phone/WhatsApp/Instagram/Facebook/slogan/menu times/delivery fee can be saved from the admin and immediately displayed on the public header/footer.

It also includes the daily-menu publish flow and the delivery dispatch screen with route/stops and driver-location polling for the admin.

## Supabase
Run `supabase/chef_noor_final_migration.sql` after the duplicate `daily_menu` dates have already been cleaned. The migration adds the production hardening and delivery tables/fields.

## Build
```bash
npm install
npm run build
```

Then deploy the project to Vercel.
