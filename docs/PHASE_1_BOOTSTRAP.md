# Faz 1 Bootstrap Rehberi

Bu rehber sırasıyla uygulanır.

## 1) Git ve GitHub
1. Bu klasörde git başlat:
   - `git init`
2. İlk commit:
   - `git add . && git commit -m "chore: bootstrap alpi360 docs and phase1 skeleton"`
3. GitHub repo oluştur ve remote bağla:
   - `git remote add origin <GITHUB_REPO_URL>`
   - `git branch -M main`
   - `git push -u origin main`

## 2) Next.js Proje Kurulumu
Bu klasör boş olduğu için doğrudan köke kurulum önerilir:
- `npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"`

Not: Bu komut bazı dosyaları overwrite etmek isteyebilir; mevcut md/docs dosyalarını koruyarak ilerle.

## 3) Supabase Bağlantısı
1. Supabase'de yeni proje oluştur.
2. Project Settings > API'den al:
   - URL
   - anon key
   - service role key
3. `.env.local` dosyasına `.env.example` üzerinden değerleri gir.

## 4) SQL Migration Uygulama
Aşağıdaki migration dosyasını Supabase SQL Editor'da çalıştır:
- `supabase/migrations/0001_platform_core.sql`

## 5) Sonraki Teknik Adım
- Tenant middleware
- Subscription/feature/permission/scope guard pipeline
- RBAC seed
