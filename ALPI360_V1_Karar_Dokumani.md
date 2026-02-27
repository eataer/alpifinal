# Alpi 360 V1 Karar Dokümanı

Bu doküman, `/Users/emre/Downloads/Alpi360_Yol_Haritasi.pptx` ve yapılan planlama görüşmeleri baz alınarak Alpi 360 için V1 sabit kararlarını içerir.

## 1) Ürün Kapsamı ve Fazlama

V1 geliştirme sırası sabittir:
1. Organizasyon ve Yetki Çekirdeği
2. Personel Yönetimi (HR Core)
3. Ürün/Kategori/Marka ve Stok Temeli
4. Ön Muhasebe Çekirdeği
5. Stok Operasyonları (Transfer ve Sayım)
6. Prim ve KPI Motoru (V1 dışı, V2)

Gerekçe: Prim hesaplama, yalnızca organizasyon, personel, stok ve finans verisi doğrulandıktan sonra güvenilir şekilde çalışır.

### 1.1) Ürün Prensibi (Bağlayıcı)

Bu proje için aşağıdaki ilke sabittir:
1. Gelişmiş, modern ve güncel UI standardı kullanılacaktır.
2. En kritik hedef basit kullanım ve düşük eğitim ihtiyacıdır.
3. Tüm yeni modül ve ekran kararları bu ilkeye göre değerlendirilir.
4. Alpi 360, müşteri için tek başına kullanılabilir pratik bir ön muhasebe çekirdeği sunmalıdır.
5. Müşteri ayrı muhasebe programı kullanmadan temel girdiler/çıktılar, borç/alacak ve günlük nakit akışını yönetebilmelidir.

## 2) Mimari Sabitler (V1)

1. Multi-tenant SaaS mimarisi zorunlu.
2. Tenant izolasyonu `tenant_id` ile sağlanır.
3. Backend tarafında scope middleware ile sorgu filtreleme zorunludur.
4. Finans ve stok işlemleri onaylı yaşam döngüsüyle çalışır: `draft -> approved -> cancelled`.
5. Audit log zorunludur: actor, action, before/after, timestamp, IP, tenant_id, branch_id.
6. Abonelik süresi biten tenant read-only moda alınır.

## 2.1) Platform Paneli ve Tenant Kurulum Standardı

Bu ürün B2B SaaS olarak satılacağı için tenant açılışı yalnızca platform panelinden yapılır.

Platform panelinde şirket (tenant) tanımlarken şu alanlar zorunludur:
1. Firma temel bilgileri:
   - firma adı
   - vergi no / ünvan (opsiyonel)
   - iletişim e-posta / telefon
   - subdomain (ör. `firmaa.seninapp.com`)
2. Şirket kategorisi/sektörü (ör. telekom, perakende, servis)
3. Aktif edilecek modüller (rol-yetki, HR, stok, ön muhasebe, raporlama vb.)
4. Paket seviyesi (Basic/Pro/Enterprise)
5. Firma durumu: `active`, `suspended`, `trial`, `cancelled`
6. Kullanım limitleri (quota):
   - `max_branches` (sayısal veya `unlimited`)
   - `max_active_users` (sayısal veya `unlimited`)
   - opsiyonel `max_employees` (personel kartı için ayrı limit)

Limit veri modeli kararı:
1. `NULL` veya `-1` değeri `unlimited` olarak yorumlanır.
2. Ticari varsayılan limitleme `active user` üstünden yapılır.
3. `employee` ve `user` ayrı kavramdır:
   - `employee`: personel kartı
   - `user`: giriş yapabilen hesap

Platform panelinde tenant kartında zorunlu kullanım metrikleri gösterilir:
1. `Aktif mağaza sayısı / limit` (ör. `3/5`, unlimited ise `3/Sınırsız`)
2. `Aktif kullanıcı sayısı / limit` (ör. `42/50`, unlimited ise `42/Sınırsız`)
3. `Kurulum tamamlanma yüzdesi` (completed şube oranı)
   - formül: `completed_branches / total_branches * 100`
   - örnek: `4/5 = %80`

Sektör bazlı hazır şablon (template) kullanımı zorunlu olarak desteklenir:
1. Tenant açılışında `template_type` seçilir (ör. `telecom_template`).
2. Seçilen şablon, şirkete başlangıç verilerini otomatik yükler:
   - kategori ağacı
   - örnek ürün tipleri
   - varsayılan departman/pozisyon seti
   - önerilen rol/izin setleri
3. Şablonla gelen veriler tenant içinde sonradan düzenlenebilir/pasife alınabilir.
4. Şablon yükleme işlemi idempotent olmalıdır; aynı şablon tekrarlı veri üretmemelidir.

Template/seed seçim kuralı (platform paneli):
1. Platform yöneticisi tenant oluştururken seed profilini seçer.
2. Örnek: `telecom_turkcell_profile` seçilirse rol/kategori/default ayarlar otomatik yüklenir.
3. Farklı sektörde istenirse `no_seed_profile` seçilebilir (boş başlangıç).
4. `no_seed_profile` senaryosunda firma rolleri ve kategorileri kendi panelinden sıfırdan tanımlar.

### 2.2) Kullanım Süresi ve Abonelik Hatırlatma Kuralları

Tenant aboneliği tarih bazlı yönetilir:
1. `subscription_start_date`
2. `subscription_end_date`
3. `subscription_status` (`trial`, `active`, `suspended`, `expired`, `cancelled`)
4. opsiyonel `grace_period_days`
5. opsiyonel `auto_renew`
6. `plan_name` / `package_id`
7. `billing_email`

Örnek kullanım: 6 aylık paket için başlangıç ve bitiş tarihi tenant kaydında tutulur.

Kalan süre eşik günlerine düştüğünde üç kanalda uyarı zorunludur:
1. Platform paneli (senin ekranın): tenant kartında uyarı rozeti/bildirim
2. Firma paneli: üst alanda uyarı bannerı (tüm kullanıcılara görünür)
3. E-posta: firmanın kayıtlı iletişim e-posta adresine hatırlatma maili

Hatırlatma zamanlaması:
1. `T-30`, `T-14`, `T-7`, `T-3`, `T-1`
2. Bitiş günü: `T-0`
3. Bitiş sonrası: `POST-1`, `POST-3` (grace period varsa)

Gönderim modeli:
1. SaaS MVP için günlük `Subscription Checker` job kullanılır (önerilen çalışma saati: 02:00).
2. Job, `end_date - today` hesaplayarak eşik günlerde bildirim üretir.
3. Aynı uyarının tekrar gitmemesi için `subscription_notifications` kaydı kontrol edilir.
4. E-posta gönderimi queue üzerinden yapılır; başarısız gönderimler retry edilir.

Süre dolum davranışı:
1. Süre dolduğunda tenant `read-only` moda geçer.
2. `Read-only` kuralı: giriş serbest, yazma işlemleri engelli (`POST/PUT/PATCH/DELETE` bloklanır).
3. Read-only mod bilgisi hem platform panelinde hem firma panelinde görünür.
4. İstisna endpoint'leri: login/logout, abonelik-billing sayfaları, destek talebi, okuma endpoint'leri.

Platform paneli görünümü:
1. Tenant satırında `Kalan gün`, `Bitiş tarihi`, `Durum (Active/Expiring/Expired)` alanları zorunludur.
2. Bildirim merkezi listeleri:
   - Expiring tenants
   - Expired tenants
   - Bu hafta bitecekler filtresi

### 2.3) Modül Bazlı Paketleme (Feature Entitlement)

SaaS modelinde limitlere ek olarak modül aç/kapat zorunludur.

Temel kavramlar:
1. `Feature/Module`: ürün modülü (ör. `hr`, `inventory`, `accounting`)
2. `Plan`: Basic / Pro / Enterprise
3. `Entitlement`: tenant'ın ilgili modülü kullanıp kullanamayacağı

Entitlement modeli:
1. Plan seviyesinde modül seti tanımlanır.
2. Tenant seviyesinde override desteklenir:
   - `inherit`: plandan miras al
   - `enable`: planda kapalı olsa da aç
   - `disable`: planda açık olsa da kapat
3. Bu model satış istisnaları için zorunludur.

Kontrol sırası (backend):
1. `Subscription` kontrolü
2. `Feature` kontrolü
3. `Permission` kontrolü
4. `Scope` kontrolü

UI ve API davranışı:
1. Modül kapalıysa menüde görünmez.
2. URL veya API ile erişimde `403 FEATURE_DISABLED` döner.
3. Kapalı modülün permission'ları rol ekranında gösterilmez.
4. Modül kapanınca veri silinmez; erişim kapanır, tekrar açılınca veri geri görünür.

Başlangıç paket stratejisi (modül bazlı):
1. Basic: `organization`, `users_roles`, `hr`, `sales_entry`, `reports_basic`
2. Pro: Basic + `kpi_targets`, `inventory`, `accounting`, `cashbox`
3. Enterprise: Pro + `reports_advanced`, `api_integrations`, `commission_engine`

## 3) Rol ve Yetki Modeli (V1)

### 3.1 Rol Katmanları

Platform (SaaS sahibi paneli):
1. Platform Owner
2. Platform Admin
3. Platform Support

Firma içi (tenant):
1. Firma Sahibi
2. Genel Koordinatör
3. Mağaza Müdürü
4. İletişim Danışmanı
5. Kasa Sorumlusu
6. Satış Destek
7. Muhasebe Sorumlusu
8. Mağaza Müdür Yardımcısı
9. Raporlama
10. İnsan Kaynakları
11. Depo-Sayım
12. Özel Rol (firma tanımlar)

İlk kurulum (seed) rol seti:
1. Firma Sahibi
2. Genel Koordinatör
3. Mağaza Müdürü
4. İletişim Danışmanı
5. Kasa Sorumlusu
6. Satış Destek
7. Muhasebe Sorumlusu
8. Mağaza Müdür Yardımcısı
9. Raporlama
10. İnsan Kaynakları
11. Depo-Sayım

Rol yönetim kuralları:
1. Sistem yöneticisi seed rolleri silemez; pasife alabilir.
2. Sistem yöneticisi yeni rol ekleyebilir.
3. Seed (sistem) rollerin yetkileri düzenlenebilir (gelişmiş yetki ekranı).
4. Özel (custom) rollerin yetkileri düzenlenebilir.
5. Son aktif `Firma Sahibi` rolü pasife alınamaz.
6. Rol isimleri değiştirilebilir.
7. Rol/yetki düzenleme serbesttir; rol dağıtımı `role_assignment_rules` ile ayrıca sınırlandırılır.

### 3.1.1) Rol Türleri ve Koruma Modeli

Rol türleri:
1. Sistem Rolleri (`template/protected`)
2. Özel Roller (`custom`)

Sistem rolleri kuralları:
1. Rol silinemez; pasife alınabilir.
2. `Firma Sahibi` rolü pasife alınamaz.
3. En az bir aktif owner zorunludur.
4. İsim etiketi değiştirilebilir.
5. Yetkiler gelişmiş yetki ekranında düzenlenebilir.

Özel roller kuralları:
1. Firma istediği kadar özel rol ekleyebilir.
2. Özel rollerin yetkileri düzenlenebilir.
3. Özel roller pasife alınabilir.

Kopyala ve özelleştir kuralı:
1. Sistem rolleri için `Kopyala` aksiyonu bulunur.
2. Kopyadan üretilen rol `custom` olur ve düzenlenebilir.
3. Örnek: `Mağaza Müdürü (Kopya)` -> tenant'a özel yetki seti.

### 3.1.2) Rol Atama Delegasyon Kuralları

Çalışan ekleme veya kullanıcı güncellemede rol ataması `role_assignment_rules` ile sınırlandırılır.

Temel kural:
1. Kullanıcı sadece kendisine izin verilen rollerden atama yapabilir.
2. Rol atama ayrı bir güvenlik katmanıdır; yetki matrisi serbest olsa bile bu kural zorunludur.
3. `Firma Sahibi` rolü yalnızca `Firma Sahibi` tarafından atanabilir.
4. Backend doğrulaması zorunludur: izinli listede olmayan hedef rol için `403 ROLE_ASSIGN_NOT_ALLOWED`.

Rol atama için gerekli permission anahtarları:
1. `users.invite`
2. `users.assign_role`

Varsayılan atama politikası (seed):
1. `Firma Sahibi`:
   - tüm rolleri atayabilir (`Firma Sahibi` dahil)
2. `Genel Koordinatör`:
   - `Firma Sahibi` hariç tüm rolleri atayabilir
3. `İnsan Kaynakları`:
   - `Mağaza Müdürü`
   - `Mağaza Müdür Yardımcısı`
   - `İletişim Danışmanı`
   - `Kasa Sorumlusu`
   - `Satış Destek`
   - `Depo-Sayım`
   - `Raporlama`
4. `Mağaza Müdürü`:
   - `İletişim Danışmanı`
   - `Kasa Sorumlusu`
   - `Satış Destek`
   - `Depo-Sayım`
5. `Mağaza Müdür Yardımcısı`:
   - `İletişim Danışmanı`
   - `Satış Destek`
6. `Muhasebe Sorumlusu`, `Raporlama`, `Depo-Sayım`, `Kasa Sorumlusu`, `Satış Destek`, `İletişim Danışmanı`:
   - rol atayamaz
7. Atama ekranında yalnızca izinli roller listelenir.

### 3.2 Kritik Karar: Kullanıcı-Rol

V1 işletim kuralı: `1 kullanıcı = 1 aktif rol`.

Not: Kod altyapısı çoklu rolü destekleyecek şekilde genişletilebilir bırakılır; V1 arayüz ve iş kuralında tek aktif rol uygulanır.

### 3.2.1) Varsayılan Yetki ve Scope Seed (Özet)

Bu seed, ilk kurulumda hazır çalışan başlangıç politikasıdır; tenant sonradan düzenleyebilir.

1. `Firma Sahibi`:
   - tüm modüllerde tam yetki (`entire_company`)
2. `Genel Koordinatör`:
   - operasyon modüllerinde tam/yakın tam yetki (`entire_company`)
   - `Firma Sahibi` atama yetkisi yok
3. `İnsan Kaynakları`:
   - `employees.view/create/update`, `users.invite`, `users.assign_role` (`entire_company`)
   - finansal yazma yetkileri varsayılan kapalı
4. `Mağaza Müdürü`:
   - `employees.view/create/update`, `sales.view/create/update`, `inventory.view`, `reports.view` (`assigned_branch`)
   - rol atama yalnız seed politikadaki alt rollerle sınırlı
5. `Mağaza Müdür Yardımcısı`:
   - müdürün alt seti (`assigned_branch`)
6. `İletişim Danışmanı`:
   - kendi satış/performans kayıtlarını görür (`self_record`), sınırlı satış işlemi (`assigned_branch`)
7. `Kasa Sorumlusu`:
   - kasa/tahsilat ekranları (`assigned_branch`)
8. `Satış Destek`:
   - satış operasyonuna destek izinleri (`assigned_branch`)
9. `Muhasebe Sorumlusu`:
   - ön muhasebe/cari/finans raporları (`entire_company`)
10. `Raporlama`:
    - yalnız `view/export` yetkileri (`entire_company` veya atanmış kapsam)
11. `Depo-Sayım`:
    - stok/sayım/transfer işlemleri (`assigned_branch`)

### 3.3 İzin Aksiyonları

Standart aksiyon sözlüğü:
- `View`, `Create`, `Update`, `Delete(iptal/pasif)`, `Approve`, `Export`, `Assign`, `Close`, `Reopen`, `ManageRoles`, `ManageUsers`, `AuditView`

### 3.3.1) Permission Catalog (Seed - Uygulanabilir Liste)

Bu katalog, backend ve frontend implementasyonu için standart referanstır.

Format:
1. `İşlem/Endpoint`
2. `Permission Key`
3. `Varsayılan Scope`

Organization:
1. `GET /branches` -> `branches.view` -> `assigned_branch` / `entire_company`
2. `POST /branches` -> `branches.create` -> `entire_company`
3. `PATCH /branches/:id` -> `branches.update` -> `entire_company`
4. `POST /branches/:id/deactivate` -> `branches.deactivate` -> `entire_company`
5. `GET /departments` -> `departments.view` -> `assigned_branch` / `entire_company`
6. `POST /departments` -> `departments.create` -> `entire_company`
7. `PATCH /departments/:id` -> `departments.update` -> `entire_company`
8. `POST /departments/:id/deactivate` -> `departments.deactivate` -> `entire_company`

Users & Roles:
1. `GET /users` -> `users.view` -> `assigned_branch` / `entire_company`
2. `POST /users/invite` -> `users.invite` -> `assigned_branch` / `entire_company`
3. `PATCH /users/:id` -> `users.update` -> `assigned_branch` / `entire_company`
4. `POST /users/:id/suspend` -> `users.suspend` -> `assigned_branch` / `entire_company`
5. `POST /users/:id/terminate` -> `users.terminate` -> `entire_company`
6. `POST /users/:id/assign-role` -> `users.assign_role` -> `assigned_branch` / `entire_company`
7. `GET /roles` -> `roles.view` -> `entire_company`
8. `POST /roles` -> `roles.create` -> `entire_company`
9. `PATCH /roles/:id` -> `roles.update` -> `entire_company`
10. `POST /roles/:id/deactivate` -> `roles.deactivate` -> `entire_company`
11. `PATCH /roles/:id/permissions` -> `roles.permissions.manage` -> `entire_company`
12. `PATCH /roles/:id/assignment-rules` -> `roles.assignment_rules.manage` -> `entire_company`

Employees (HR):
1. `GET /employees` -> `employees.view` -> `self_record` / `assigned_branch` / `entire_company`
2. `POST /employees` -> `employees.create` -> `assigned_branch` / `entire_company`
3. `PATCH /employees/:id` -> `employees.update` -> `assigned_branch` / `entire_company`
4. `POST /employees/:id/suspend` -> `employees.suspend` -> `assigned_branch` / `entire_company`
5. `POST /employees/:id/terminate` -> `employees.terminate` -> `entire_company`
6. `POST /employees/:id/invite-user` -> `employees.invite_user` -> `assigned_branch` / `entire_company`
7. `GET /employee-fields` -> `employee_fields.view` -> `entire_company`
8. `POST /employee-fields` -> `employee_fields.create` -> `entire_company`
9. `PATCH /employee-fields/:id` -> `employee_fields.update` -> `entire_company`
10. `POST /employee-fields/:id/deactivate` -> `employee_fields.deactivate` -> `entire_company`

Sales:
1. `GET /sales` -> `sales.view` -> `self_record` / `assigned_branch` / `entire_company`
2. `POST /sales` -> `sales.create` -> `self_record` / `assigned_branch`
3. `PATCH /sales/:id` -> `sales.update` -> `self_record` / `assigned_branch`
4. `POST /sales/:id/deactivate` -> `sales.deactivate` -> `assigned_branch` / `entire_company`
5. `GET /sales/export` -> `sales.export` -> `assigned_branch` / `entire_company`

KPI & Targets:
1. `GET /kpi` -> `kpi.view` -> `self_record` / `assigned_branch` / `entire_company`
2. `POST /kpi-targets` -> `kpi.targets.create` -> `assigned_branch` / `entire_company`
3. `PATCH /kpi-targets/:id` -> `kpi.targets.update` -> `assigned_branch` / `entire_company`
4. `GET /kpi/export` -> `kpi.export` -> `assigned_branch` / `entire_company`

Inventory:
1. `GET /inventory` -> `inventory.view` -> `assigned_branch` / `entire_company`
2. `POST /inventory/movements` -> `inventory.movements.create` -> `assigned_branch`
3. `PATCH /inventory/movements/:id` -> `inventory.movements.update` -> `assigned_branch`
4. `POST /inventory/counts` -> `inventory.counts.create` -> `assigned_branch`
5. `POST /inventory/counts/:id/approve` -> `inventory.counts.approve` -> `assigned_branch` / `entire_company`
6. `GET /inventory/export` -> `inventory.export` -> `assigned_branch` / `entire_company`

Accounting:
1. `GET /accounting/ledger` -> `accounting.view` -> `assigned_branch` / `entire_company`
2. `POST /accounting/entries` -> `accounting.create` -> `assigned_branch` / `entire_company`
3. `PATCH /accounting/entries/:id` -> `accounting.update` -> `assigned_branch` / `entire_company`
4. `POST /accounting/entries/:id/approve` -> `accounting.approve` -> `entire_company`
5. `GET /accounting/export` -> `accounting.export` -> `entire_company`

Cashbox:
1. `GET /cashbox` -> `cashbox.view` -> `assigned_branch` / `entire_company`
2. `POST /cashbox/transactions` -> `cashbox.create` -> `assigned_branch`
3. `PATCH /cashbox/transactions/:id` -> `cashbox.update` -> `assigned_branch`
4. `POST /cashbox/close-day` -> `cashbox.close` -> `assigned_branch`
5. `POST /cashbox/close-day/:id/approve` -> `cashbox.approve` -> `entire_company`
6. `GET /cashbox/export` -> `cashbox.export` -> `assigned_branch` / `entire_company`

Reports:
1. `GET /reports` -> `reports.view` -> `self_record` / `assigned_branch` / `entire_company`
2. `GET /reports/export` -> `reports.export` -> `assigned_branch` / `entire_company`

Audit:
1. `GET /audit-logs` -> `audit.view` -> `entire_company`
2. `GET /audit-logs/export` -> `audit.export` -> `entire_company`

### 3.4 Scope Sözlüğü

- `entire_company`
- `assigned_region`
- `assigned_branch`
- `self_record`
- `custom_scope` (JSON `rule_definition`, enterprise özellik)

### 3.5 Kritik Yetkiler

- `MR` = ManageRoles
- `RO` = Reopen
- `CL` = Close

Kural:
1. Bu yetkiler panelden açılıp kapatılabilir.
2. Sadece üst yetkili roller değiştirebilir.
3. Tüm değişiklikler audit log'a yazılır.
4. Kullanıcı kendi yetkisinin üstünde yetki veremez.
5. Son Firma Sahibi pasifleştirilemez ve kritik sahiplikten düşürülemez.

## 4) Organizasyon ve Otomasyon Kuralları

1. Hiyerarşi: Bölge -> İl -> Mağaza -> Departman.
2. Firma yetkilisi, kendisine `branches.create` yetkisi verildiyse kendi şubelerini oluşturabilir.
3. Şube tanımlama ekranında en az şu bilgiler girilir:
   - şube adı
   - şube kodu (tenant içinde benzersiz, manuel girilir)
   - il/ilçe (opsiyonel)
   - adres
   - telefon
   - e-posta
   - mağaza tipi (opsiyonel)
   - açılış tarihi (opsiyonel)
   - durum (aktif/pasif)
4. Telekom odaklı opsiyonel alanlar:
   - çalışma modeli (09-18, vardiya vb.)
   - kasa kullanımı var mı
   - depo kullanımı var mı
5. Yeni şube oluşturulduğunda otomatik `Şube Kasası` ve `Şube Deposu` provizyon edilir.
6. Çok şubeli yapılarda kullanıcı erişimi atanmış şubelerle sınırlandırılır.
7. Kurulum ve yönetim ekranlarında kalan hak göstergesi zorunludur:
   - `Kalan mağaza hakkı: 3/5`
   - `unlimited` durumda `Sınırsız`
8. Şube pasife alınırken personel için seçim ekranı açılır:
   - mevcut şubede pasif bırak
   - seçili aktif şubeye toplu kaydır

### 4.1) Şube Kodu Kuralları

1. `branch.code` manuel girilir ve tenant içinde unique olmalıdır.
2. `branch.code` zorunlu alandır.
3. Format validasyonu zorunludur:
   - minimum 2, önerilen 3 karakter
   - boşluk içeremez
   - TR karakter desteği opsiyoneldir (tenant ayarı ile açılabilir)
4. Varsayılan kural: kurulumdan sonra `branch.code` değiştirilemez.
5. İstisna olarak değişime izin verilirse zorunlu audit log yazılır.

### 4.2) Şube Pasifleştirme Sihirbazı

1. `Şubeyi pasife al` aksiyonu bir modal/wizard ile çalışır.
2. İşlem öncesi özet gösterilir:
   - bu şubeye bağlı kullanıcı sayısı
   - bu şubeye bağlı personel sayısı
3. Seçenekler:
   - Kaydır: seçilen kişi/hesapları hedef aktif şubeye taşı
   - Olduğu gibi bırak: pasif şubede bırak (riskli)
   - Pasifleştir: kullanıcı hesabını suspended yap (opsiyonel)
4. Varsayılan iş akışı: `Kaydır` (isteğe bağlı toplu/seçili taşıma).
5. Primary branch kuralı:
   - pasif şube primary ise hedef şube primary yapılır
6. Çoklu şube atamasında:
   - yalnız pasif şube ataması kaldırılır
   - diğer aktif atamalar korunur

### 4.3) Personel ve Kullanıcı Kaydırma Kuralı

1. Kaydırma işlemi hem `employee` hem `user` kayıtlarını kapsar.
2. Bağlı login hesabı varsa `employee_branches` ve `user_branches` birlikte güncellenir.
3. HR kaydı ile login hesabı senkron bozulmayacak şekilde transaction içinde güncellenir.

### 4.4) Pasif Şube ve Scope Etkisi

1. Pasif şubeler `assigned_branch` scope filtrelerinde aktif veri kaynağı sayılmaz.
2. Kullanıcı yalnızca aktif şube atamalarına göre veri görür.
3. Pasifleştirme sonrası aktif şubesi kalmayan kullanıcılar için varsayılan aksiyon:
   - otomatik `suspended` (varsayılan açık)
4. Alternatif olarak admin panelinde `aktif şube ataması yok` uyarısı gösterilir.

### 4.5) Şube Pasifleştirme Loglama

1. Audit log zorunludur:
   - `action`: `BRANCH_DEACTIVATE`
   - `details`: hedef şube, taşınan kullanıcı/personel sayısı, işlemi yapan kullanıcı
2. Opsiyonel geçmiş tablosu:
   - `branch_status_history(branch_id, old_status, new_status, changed_by, changed_at)`

### 4.6) Şube UI Davranışı

1. Şube listesinde aktif/pasif filtreleri bulunur.
2. Pasif şubeler gri tonla gösterilir.
3. Pasifleştirme wizard'ında aşağıdaki kontroller varsayılan açık gelir:
   - `Primary şubesi pasif olanları otomatik güncelle`
   - `Aktif şubesi kalmayan kullanıcıları suspended yap`

### 4.7) Quota Uygulama Kuralları

1. `branches.create` işleminde `max_branches` kontrolü zorunludur.
2. Varsayılan sayım kuralı: yalnızca `is_active = true` şubeler limite sayılır.
3. Kontrol formülü: `active_branch_count + 1 <= max_branches` (unlimited değilse).
4. `users.activate` veya aktif kullanıcı oluşturma işlemlerinde `max_active_users` kontrolü zorunludur.
5. Personel kartı açma işlemi varsayılan olarak limitlenmez; opsiyonel `max_employees` açılırsa kontrol edilir.
6. Limit aşımında işlem engellenir; hata kodu ve kullanıcı mesajı birlikte döner.

### 4.8) Tenant Onboarding Wizard

Firma yetkilisi ilk girişte kurulum sihirbazını görür:
1. Adım 1: Firma bilgileri (logo, adres, çalışma saatleri) - opsiyonel
2. Adım 2: Organizasyon ayarları (region kullanımı, departmanlar) - opsiyonel
3. Adım 3: Şube/Mağaza oluşturma - zorunlu
4. Adım 4: İlk kullanıcı davetleri (mağaza müdürü, insan kaynakları vb.) - opsiyonel

### 4.9) Branch Yetki Seti

Tenant permission anahtarları:
1. `branches.view`
2. `branches.create`
3. `branches.update`
4. `branches.deactivate`
5. opsiyonel `branches.activate`

Varsayılan rol dağılımı:
1. Firma Sahibi / Firma Admin: full
2. Genel Koordinatör: `view`, `create`, `update`
3. Mağaza Müdürü: varsayılan olarak yeni şube açamaz

### 4.10) Limit Aşımı Mesaj Standardı

Örnek kullanıcı mesajı:
`Mağaza limitiniz doldu (5/5). Yeni mağaza eklemek için paket yükseltin veya mevcut mağazalardan birini pasife alın.`

## 5) Personel (HR Core) Sabitleri

1. Personel kartında sabit alanlar zorunludur ve kaldırılamaz:
   - ad
   - soyad
   - kullanıcı adı
   - telefon numarası
   - TC kimlik numarası
   - doğum tarihi
   - e-posta adresi
   - adres
   - bağlı olduğu şube
2. Dinamik alanlar firma sistem yöneticisi tarafından yönetilir (`alan ekle`, `alan düzenle`, `alan pasife al`).
3. Dinamik alan tipleri: metin, sayı, tarih, dropdown, boolean.
4. Örnek dinamik alanlar: üst beden, kan grubu, sertifika tipi, eğitim seviyesi.
5. Personel kaydı oluşturma/güncelleme işlemi rol bazlı yetkiyle çalışır; bu yetki hangi role verilirse o rol işlem yapabilir (ör. Mağaza Müdürü, İnsan Kaynakları, Genel Koordinatör).
6. Scope kuralı zorunludur: kullanıcı yalnızca yetkili olduğu kapsamda (`assigned_branch`, `assigned_region`, `entire_company`) personel işlemi yapar.
7. Personel kaydı ile birlikte login hesabı oluşturulabilir; sistem davet e-postası gönderir.
8. Davet e-postası içinde tek kullanımlık kurulum bağlantısı bulunur; personel şifresini belirleyip ilk girişini tamamlar.
9. Kullanıcı yaşam döngüsü: aktif, pasif, kilitli, davet bekliyor.
10. Telekom özel yetki alanları V1 veri modeline dahil edilir:
   - operatör işlem yetkisi
   - kampanya satış yetkisi
   - IMEI işlem yetkisi

## 6) Stok ve Ürün Sabitleri

1. Kategori hiyerarşisi (parent-child) kullanılacaktır.
2. Ürün takip türleri: `none`, `serial`, `IMEI`, `ICCID`.
3. Seri kuralı sabit: `1 seri = 1 fiziksel ürün` ve tenant genelinde benzersiz.
4. Alım faturası onaylandığında tek transaction ile stok, cari ve maliyet etkisi yaratılır.

### 6.1) Satış Kategori Seed Listesi (Varsayılan)

İlk kurulumda aşağıdaki satış kategorileri hazır (seed) gelir:
1. Akıllı Telefon
2. Tablet
3. YNT (Yeni Nesil Teknoloji)
4. Aksesuar
5. Hazırkart
6. Yedek Simkart
7. Faturalı Yeni
8. Faturalı MNT
9. Faturalı Data
10. Hazırkart MNT
11. Hazırkart Data
12. Switch
13. Geri Verme
14. Devir İşlemleri
15. Sigorta

`Aksesuar` alt kategorileri (seed):
1. Kılıf
2. Ekran Koruyucu
3. Şarj Aleti
4. Data ve Kablo
5. Bluetooth Kulaklık
6. Kablolu Kulaklık
7. Powerbank

### 6.2) Kategori Yönetim Kuralları

1. Firma, seed kategorilere ekleme yapabilir.
2. Firma, seed kategori adlarını düzenleyebilir.
3. Firma, kategorileri pasife alabilir/aktive edebilir.
4. Hard delete yerine `deactivate` yaklaşımı kullanılır.
5. Kategori değişiklikleri audit log'a yazılır.
6. Bu kategori seti başlangıç satış KPI kırılımlarının temelidir.
7. Seed kategoriler tenant oluşturulurken platform panelinden profile göre seçilir.
8. `no_seed_profile` seçilen tenant'larda kategori listesi boş başlar ve firma kendi kategorilerini oluşturur.
9. Kategori davranış ayarları tenant tarafından düzenlenebilir:
   - stoklu/stoksuz
   - stok davranışı (increase/decrease/none)
   - SIM zorunluluğu
   - varsayılan takip tipi (seri/IMEI/ICCID şablonu)

### 6.3) Ürün Kartı Tanımlama Yapısı

Ürün kartı, kategoriye bağlı ve stok/satış/muhasebe davranışını belirleyen ana kayıttır.

Ürün kartı UI yapısı (sekmeli):
1. Genel
2. Stok ve Takip
3. Fiyat ve Vergi
4. Satın Alma ve Notlar (opsiyonel)

Genel sekmesi - zorunlu alanlar:
1. Ürün adı
2. Kategori (hiyerarşik seçim: Ana > Alt)
3. SKU / ürün kodu (tenant içinde unique)
4. Durum: aktif/pasif

Genel sekmesi - opsiyonel alanlar:
1. Barkod
2. Marka
3. Model

Stok ve takip sekmesi:
1. Ürün tipi: stoklu / stoksuz (kategori varsayılanı)
2. Stok davranışı: decrease / increase / none (kategori varsayılanı)
3. Takip tipi: `none` / `serial` / `IMEI` / `ICCID`
4. SIM zorunluluğu bilgisi (kategori kuralından okunur)

Fiyat ve vergi sekmesi (MVP):
1. Satış fiyatı (tek fiyat)
2. Alış maliyeti (opsiyonel)
3. KDV oranı (kategori default, ürün override opsiyonel)

Satın alma ve notlar sekmesi (opsiyonel):
1. Tedarikçi (cariye bağlanabilir)
2. Garanti süresi
3. Ürün notu
4. Ürün görseli

Kategori seçimi kuralları:
1. Her ürün mutlaka bir kategoriye bağlı olmalıdır.
2. Kategori davranış ayarları ürün kartına varsayılan değer olarak gelir.
3. Ürün kartında varsayılan ayarlar gerektiğinde override edilebilir (tenant kuralına bağlı).
4. Stoklu kategoride ürün seçimi satışta zorunludur.
5. Stoksuz kategoride ürün seçimi opsiyonel olabilir (hizmet/işlem senaryosu).

Takip ve doğrulama kuralları:
1. `IMEI` seçiliyse satışta IMEI seçimi zorunludur.
2. `ICCID` seçiliyse satışta ICCID seçimi zorunludur.
3. `serial` seçiliyse tekil seri numarası zorunludur.
4. `none` seçiliyse adet bazlı işlem yapılır.
5. Fiziksel ürünlerde stok takibi zorunludur.
6. SIM fiziksel ürünü (ör. yedek SIM kart) için `ICCID` tekil takip uygulanır.

Seri numarası temel prensibi (çekirdek kural):
1. `1 seri = 1 fiziksel ürün` (TC kimlik gibi tekil).
2. Aynı `unit_code` tenant içinde ikinci kez kayıt edilemez.
3. DB seviyesinde tekillik: `UNIQUE(tenant_id, unit_code_normalized)`.
4. `unit_code_normalized` standardı:
   - boşluklar temizlenir
   - büyük harfe çevrilir
   - tip bazlı karakter temizliği uygulanır (IMEI/ICCID için).
5. Onay aşamasında seri tekillik kontrolü transaction içinde tekrar zorunludur.
6. Seri bir kez ürün kartına bağlandıktan sonra farklı ürüne taşınmaz; düzeltme iptal/iade akışıyla yapılır.

Ürün ve stok veri modeli (minimum):
1. `products`:
   - `id`, `tenant_id`, `name`, `category_id`, `sku`, `barcode`
   - `brand`, `model`
   - `tracking_type` (`none|serial|imei|iccid`)
   - `vat_rate`, `sale_price`, `cost_price`
   - `is_active`, `created_at`
2. `inventory_items` (serisiz stok):
   - `tenant_id`, `branch_id`, `product_id`, `quantity`
3. `inventory_units` (serili stok):
   - `tenant_id`, `branch_id`, `product_id`, `unit_code`
   - `status` (`in_stock|sold|returned|transferred|reserved`)
   - `created_at`

### 6.4) Ürün İçe/Dışa Aktar (Template) Standardı

Çoklu veri yönetimi için ürün kartlarında import/export zorunlu desteklenir.

İçe aktarma (import):
1. Şablon formatları: CSV/XLSX
2. `MVP Ürün Kartı` şablon kolonları:
   - `sku`
   - `name`
   - `category_path` (örn: `Aksesuar > Kılıf`)
   - `tracking_type` (boşsa kategori default)
   - `barcode` (opsiyonel)
   - `brand` (opsiyonel)
   - `model` (opsiyonel)
   - `vat_rate` (opsiyonel)
   - `sale_price` (opsiyonel)
   - `is_active`
3. `Serili Stok` şablon kolonları:
   - `branch_code`
   - `sku`
   - `unit_code` (IMEI/ICCID/serial)
   - `status` (default `in_stock`)
4. `Serisiz Stok` şablon kolonları:
   - `branch_code`
   - `sku`
   - `quantity`
5. Import önizleme ekranı zorunludur (eklenecek/güncellenecek/hatalı satır özeti).
6. Hatalı satırlar satır bazında raporlanır ve indirilebilir hata dosyası üretilir.
7. Onay olmadan DB'ye yazılmaz.
8. Import modu kullanıcı seçimiyle çalışır:
   - `insert_only` (SKU varsa atla)
   - `upsert` (SKU eşleşirse güncelle)
9. Import işlemi idempotent çalışmalıdır.

Dışa aktarma (export):
1. Filtrelenmiş ürün listesi CSV/XLSX dışa aktarılabilir.
2. Dışa aktarma kolonları kullanıcı tarafından seçilebilir (opsiyonel v2).
3. Export dosyasında kategori yolu ve takip tipi açıkça yer alır.

Kullanım kolaylığı:
1. Ekranda `Şablon İndir` butonu bulunur.
2. `Örnek Dolu Şablon` seçeneği bulunur.
3. Import sonucu için işlem özeti + hata dosyası indirme sunulur.
4. Import wizard adımları: `Dosya Yükle -> Önizleme -> Onay -> Sonuç`.

### 6.5) Ürün Modülü RBAC Anahtarları

Permission key seti:
1. `products.view`
2. `products.create`
3. `products.update`
4. `products.deactivate`
5. `products.import`
6. `products.export`

Varsayılan scope:
1. Ürün master işlemleri: `entire_company`
2. Şube stok işlemleri: `assigned_branch` / `entire_company`

### 6.6) Ürün UI Akış Standardı

Ürün ekleme hızlı akış (MVP):
1. Ürün adı
2. Kategori
3. SKU
4. Takip tipi (kategori default ile gelir)
5. Kaydet

Kaydet sonrası:
1. Opsiyonel `Stok Ekle` drawer'ı açılır.
2. Kullanıcı isterse stok girişini sonra yapabilir.

### 6.6.1) Ürün Liste Ekranı (Modern ve Basit)

Ekran hedefi:
1. Çoklu veriyle hızlı çalışma
2. Excel benzeri akış ama sade görünüm
3. Sık işlemlere tek ekrandan erişim

Sayfa başlığı ve üst aksiyonlar:
1. Sol: `Ürünler`
2. Sağ:
   - `Ürün Ekle` (primary)
   - `İçe Aktar` (secondary)
   - `Dışa Aktar` (secondary)
   - opsiyonel `Sütunlar`

Arama + filtre barı (tek satır):
1. Arama: ad / SKU / barkod
2. Filtreler:
   - kategori (tree seçici)
   - marka
   - takip tipi (`none|serial|imei|iccid`)
   - durum (aktif/pasif)
   - stok durumu (opsiyonel, şube seçimi ile)
3. Aktif filtreler chip olarak görünür.

Liste/tablo kolonları (MVP):
1. Ürün adı
2. SKU
3. Kategori
4. Marka
5. Takip tipi
6. Durum
7. Aksiyonlar

Satır aksiyonları:
1. Düzenle
2. Pasife al / Aktif et
3. Stok Gör (drawer)
4. Kopyala (benzer ürün oluştur)

Ürün detay drawer:
1. Genel bilgiler
2. Fiyat
3. Takip tipi
4. Son değişiklikler
5. Şube bazlı kısa stok özeti

UX notları:
1. Satır detayları sağ drawer'da açılır (sayfa geçişi zorunlu değil).
2. Boş durum CTA: `Henüz ürün yok -> Ürün Ekle`.

### 6.6.2) Ürün Ekle Ekranı (Basit 2 Adım Wizard)

Adım 1 - Genel:
1. Ürün adı
2. Kategori (tree + arama)
3. SKU / ürün kodu
4. Barkod (opsiyonel)
5. Marka (dropdown + inline `+ Yeni Marka Ekle`)
6. Model (text)

Adım 2 - Takip ve Fiyat:
1. Takip tipi (`none|serial|imei|iccid`) - kategori default ile gelir
2. Satış fiyatı (opsiyonel)
3. KDV oranı (kategori default, ürün bazında değişebilir)

Sayfa davranışı:
1. Kategori seçimi sonrası sistem kategori davranışını arka planda hazırlar.
2. Ürün oluşturulduktan sonra mini seçenek gösterilir:
   - `Stok ekle`
   - `Listeye dön`

Validasyon:
1. SKU tenant içinde tekil olmalıdır.
2. Kategori zorunludur.
3. Takip tipine göre seri alanı kuralları uygulanır.

### 6.6.3) Stok Ekle Drawer (Hızlı Giriş)

Serisiz ürün:
1. Şube seç
2. Miktar gir
3. Kaydet

Serili ürün (IMEI/ICCID/Serial):
1. Şube seç
2. Seri listesini yapıştır (satır başına bir kod)
3. Önizleme ve tekrar eden seri uyarısı
4. Kaydet

### 6.6.4) Ürün Import Wizard (5 Adım)

Adım 1 - Şablon seç:
1. Ürün Kartı İçe Aktar
2. Serili Stok İçe Aktar
3. Serisiz Stok İçe Aktar
4. Her şablonda `Şablon İndir` + kısa açıklama

Adım 2 - Dosya yükle:
1. Drag & drop
2. Format: CSV/XLSX
3. Import modu:
   - `insert_only`
   - `upsert`
4. Kural checkbox'ları:
   - kategori yoksa hata ver
   - marka yoksa otomatik oluştur (yetkisi varsa)

Adım 3 - Kolon eşleştirme:
1. Dosya kolonları -> sistem alanları eşleştirilir
2. Eksik zorunlu alanlar bloklayıcı hata verir

Adım 4 - Önizleme ve validasyon:
1. Satır durumu: geçerli / uyarı / hatalı
2. Filtre: yalnız hatalı satırlar
3. Hata örnekleri:
   - `category_path bulunamadı`
   - `sku duplicate`
   - `imei/iccid formatı geçersiz`
   - `unit_code zaten var`
4. `Hataları indir` aksiyonu

Adım 5 - Onay ve işlem:
1. Toplam / geçerli / hatalı satır özeti
2. Seçenek:
   - sadece geçerlileri işle
   - iptal et
3. Sonuç ekranı + işlem özeti
4. İşlem log'u audit'e yazılır

Import UX kuralları:
1. Onay olmadan kalıcı yazma yapılmaz.
2. Uzun işlemlerde progress gösterilir.
3. Import idempotent çalışır.

### 6.6.5) Ürün Dışa Aktar Standardı

1. Dışa aktarma filtreli listeyi baz alır.
2. Format: Excel/CSV.
3. Yetkisi olmayan kullanıcıda export aksiyonu görünmez.

### 6.7) Marka (Brand) Master Data

Marka yönetimi ayrı bir master data olarak bulunur (kategori gibi hiyerarşik değildir).

`brands` veri modeli:
1. `id`
2. `tenant_id`
3. `name`
4. `is_active`
5. `sort_order` (opsiyonel)

Ürün kartı entegrasyonu:
1. Ürün kartında `brand` alanı searchable dropdown ile seçilir.
2. Ürün ekranında `+ Yeni Marka Ekle` inline aksiyonu bulunur.
3. Marka bulunamazsa kullanıcı akıştan çıkmadan yeni marka ekleyebilir.
4. Ürün kartında `model` alanı serbest metin olarak tutulur (ayrı model sözlüğü yok).

Marka yönetim kuralları:
1. Hazır (seed) markalar kullanıcı tarafından silinebilir.
2. Marka listesinde aktif/pasif filtresi bulunur.
3. Marka detayında ürün sayısı gösterilir.
4. Pasif marka yeni ürünlerde seçilemez; geçmiş ürünlerde referans olarak görünür.
5. Marka ürünlerde kullanılıyorsa hard delete yerine `deactivate` uygulanır (referans bütünlüğü).
6. Hiç kullanılmamış markalar hard delete ile kaldırılabilir.

Marka veri girişi:
1. Marka için içe/dışa aktarma kullanılmaz.
2. Marka ekleme manuel ve sade akışla yapılır.
3. Ürün kartı içinden inline marka ekleme ana yöntemdir.

Telekom template marka seed listesi:
1. Apple
2. Samsung
3. Xiaomi
4. Oppo
5. Redmi
6. Tecno
7. Reeder
8. Vivo
9. Infinix
10. Casper
11. TCL
12. Omix
13. Philips
14. ZTE

Template davranışı:
1. Bu seed marka listesi yalnız `Telekom Template` seçilirse otomatik yüklenir.
2. `Blank Template` senaryosunda seed marka yüklenmez.
3. Seed markalar tenant UI üzerinden düzenlenebilir, pasife alınabilir veya silinebilir (kullanım kuralına bağlı).

Marka RBAC:
1. `brands.view`
2. `brands.create`
3. `brands.update`
4. `brands.deactivate`
5. `brands.manage` (create/update/deactivate toplu yetki olarak da kullanılabilir)

Scope:
1. Marka master işlemleri `entire_company` kapsamındadır.

### 6.8) Marka-Tedarikçi İlişkisi Kararı

Karar:
1. Marka yönetimi bu fazda aktif edilir.
2. Marka-tedarikçi (cari) zorunlu ilişki bu fazda kurulmaz.
3. Cari modülüne geçildiğinde marka-tedarikçi eşlemesi ayrı kuralla eklenir.
4. Şimdilik ürün kartında tedarikçi alanı opsiyonel kalır.

## 7) Ön Muhasebe Sabitleri

Muhasebe çalışma modu tenant bazlıdır:
1. `Standalone` (tam ön muhasebe Alpi 360 içinde)
2. `External Accounting` (Logo/Mikro/Paraşüt ana sistem)

External modda çift kayıt engelleme için eşleştirme mantığı (`match/merge`) gerekir.

### 7.0) Alpi 360 Ön Muhasebe Vizyonu

1. Alpi 360, Standalone modda müşteri için birincil operasyon paneli olarak çalışır.
2. Kullanıcılar ayrı bir muhasebe aracına ihtiyaç duymadan:
   - günlük kasa hareketi
   - tahsilat/ödeme
   - cari borç/alacak takibi
   - temel gelir-gider görünümü
   işlemlerini yönetebilmelidir.
3. Arayüz sade tutulacak, kritik finans aksiyonları rehberli akışlarla yapılacaktır.

### 7.1) Faz Önceliği Notu (Satış Öncesi)

Karar: Satış giriş modülüne geçmeden önce ön muhasebe çekirdeği netleştirilecektir.

Öncelikli alt başlıklar:
1. Kasa hesapları ve hareket kuralları
2. Cari kart ve bakiye mantığı
3. Tahsilat/ödeme işlem akışı
4. Onay, iptal ve audit kuralları
5. Gün sonu/kapanış etkileri

### 7.2) Satış-Tahsilat Varsayılan Akış Kararı

Karar (hibrit model):
1. Varsayılan: `satış = tahsilat` (perakende hızlı akış).
2. İstisna: `veresiye/cari` seçilirse satış ve tahsilat ayrışır.
3. Bu durumda satış kaydı açılır, tahsilat açık kalem olarak sonradan kapatılır.

### 7.3) Cari Kartı Modeli (Tek Kart + Tip)

Karar:
1. Cari yapısı tek master kart olarak ilerler.
2. Ayrım `tip` alanı ile yapılır: `musteri`, `tedarikci`, `kurumsal`, `bayi`, `diger`.
3. Aynı cari hem müşteri hem tedarikçi olabilir (çoklu tip desteği/işaretleme).
4. Tedarikçi/kurumsal alım carileri merkez (firma geneli yetkili roller) tarafından yönetilir.
5. Şubeler satış sırasında müşteri carisi oluşturabilir (scope: `assigned_branch`).

Cari kartı zorunlu alanları (MVP):
1. Cari adı / ünvan
2. Cari tipi
3. Vergi tipi: `bireysel` / `kurumsal`
4. Durum: aktif/pasif

Cari kartı opsiyonel alanlar:
1. Telefon
2. E-posta
3. Adres, il/ilçe
4. Vergi no / vergi dairesi
5. Vade günü
6. Borç limiti
7. İskonto oranı
8. IBAN
9. Not / etiketler

Müşteri carisi hızlı kayıt kuralı:
1. Satışta müşteri telefonu girildiğinde sistem önce mevcut cari kartta arama yapar.
2. Eşleşme varsa cari bilgisi otomatik doldurulur.
3. Eşleşme yoksa ad-soyad + telefon ile hızlı müşteri carisi oluşturulabilir.
4. Sonraki satışlarda telefon bazlı eşleşme tekrar kullanılır.

### 7.4) Cari UI Akışları (Basit + Gelişmiş)

Cari listesi:
1. Arama: ünvan / telefon / vergi no
2. Filtre: tip, durum
3. Aksiyonlar: `Cari Ekle`, `İçe Aktar`, `Dışa Aktar`
4. Kolonlar (MVP): ünvan, tip, telefon, bakiye (opsiyonel), durum
5. Satır tıklamasıyla sağ drawer: cari özeti + hareketler

Cari ekleme (2 adım):
1. Adım 1 - Temel: ünvan, tip, telefon, vergi tipi
2. Adım 2 - Detay: adres, e-posta, vade/limit (gelişmiş alan)

### 7.5) Cari Hareketleri (Ön Muhasebe Bağı)

MVP hareket türleri:
1. Tahsilat (`customer payment`)
2. Ödeme (`supplier payment`)
3. Cari düzeltme (`manual adjustment`)

Kural:
1. Cari kartında `Hareketler` sekmesi bulunur.
2. Hareket kayıtlarında işlemin yapıldığı `branch_id` tutulur.
3. Cari master firma genelidir, hareketler şube bazlıdır.
4. Tedarikçi carileri üzerinden alım işlemleri ile stok giriş süreçleri bağlanır.

### 7.6) Cari Import/Export Standardı

Cari import şablonu (MVP):
1. `name` (zorunlu)
2. `type` (zorunlu: `customer/supplier/corporate`)
3. `phone`
4. `email`
5. `tax_type`
6. `tax_no`
7. `city`
8. `district`
9. `address`
10. `term_days`
11. `credit_limit`
12. `is_active`

Import akışı:
1. Şablon indir
2. Dosya yükle
3. Eşleştirme
4. Önizleme ve hata raporu
5. Onayla

### 7.7) Cari RBAC ve Scope

Permission key seti:
1. `caries.view`
2. `caries.create`
3. `caries.update`
4. `caries.deactivate`
5. `caries.import`
6. `caries.export`
7. `caries.ledger.view`
8. `caries.ledger.create`

Varsayılan scope:
1. Cari master işlemleri: `entire_company`
2. Cari hareket (ledger) işlemleri: `assigned_branch` / `entire_company`

### 7.8) Telekom Operasyon Kuralı

1. Perakende hızlı satışlarda cari açılışı zorunlu değildir (`satış=tahsilat` akışı).
2. `Veresiye/kurumsal satış` seçildiğinde cari seçimi zorunlu olur.
3. Kasa hareketleri ile cari hareketleri bağlantılı tutulur.

### 7.9) Dış Muhasebe Entegrasyon Hedefi (Logo/Mikro/Paraşüt)

Stratejik karar:
1. Sistem mimarisi Logo, Mikro, Paraşüt gibi dış muhasebe yazılımlarıyla entegre çalışacak şekilde kurulacaktır.
2. Entegrasyon hem dış sistemden içeri aktarım hem de sistemden dışa senkron akışını destekleyecektir.

Hedef senaryolar:
1. Dış sistemde oluşturulan alım faturasının sisteme aktarılması.
2. Sistemde onaylanan kayıtların dış muhasebe sistemine gönderilmesi.
3. Çift kayıt/mükerrer riskini engellemek için eşleştirme ve idempotent kontrol.

Teknik ilke:
1. `external_system`, `external_id`, `external_hash` alanlarıyla kayıt izleme.
2. Entegrasyon işlerinin kuyruk ve log yapısıyla yönetilmesi.
3. Bu entegrasyon detayları sonraki fazda ayrıca tasarlanacaktır; ancak veri modeli ve API sözleşmeleri bu hedefi şimdiden destekleyecektir.

### 7.10) Cari Kaynak ve Tekilleştirme Kuralları

Cari iki ana kaynaktan beslenir:
1. `hq` (merkez): tedarikçi/kurumsal/bayi carileri
2. `branch` (şube): satış sırasında hızlı müşteri carisi
3. `integration`: dış sistemden gelen cari kartları

`caries` önerilen alanlar:
1. `id`, `tenant_id`
2. `type` (`customer|supplier|corporate|dealer|other`)
3. `source` (`hq|branch|integration`)
4. `name`, `surname` (müşteri) veya `title` (kurumsal)
5. `phone_normalized`
6. `email`
7. `tax_type`, `tax_no`
8. `address`
9. `is_active`
10. `created_by_user_id`
11. `created_branch_id` (branch kaynaklıysa dolu)

Tekilleştirme kuralı:
1. Müşteri carisinde `phone_normalized` E.164 formatına normalize edilir.
2. `tenant_id + phone_normalized` tekilleştirme anahtarı olarak kullanılır.
3. Aynı telefon tekrar girilirse yeni kart açmak yerine mevcut cari önerilir/getirilir.

### 7.11) Satışta Telefonla Bul Akışı

1. Satış ekranında telefon girildiğinde debounce ile cari araması yapılır.
2. Eşleşme varsa müşteri bilgisi otomatik doldurulur.
3. Eşleşme yoksa `Yeni müşteri olarak kaydet` seçeneği sunulur.
4. İstenirse müşteri carisi satış tamamında otomatik oluşturulur (hızlı akış).

### 7.12) Cari Yetki Ayrımı (Merkez vs Şube)

Merkez (Owner/Koordinatör/Muhasebe):
1. `caries.create_supplier`
2. `caries.create_corporate`
3. `caries.update`
4. `caries.import` / `caries.export`

Şube:
1. `caries.create_customer`
2. `caries.customer.view`
3. opsiyonel `caries.customer.update`

UI kuralı:
1. Şube kullanıcılarında cari tipinde `supplier/corporate` seçenekleri gösterilmez.

### 7.13) Entegrasyon İçin Dış Referans ve Idempotency

External referans alanları:
1. `external_system` (`logo|mikro|parasut`)
2. `external_id`
3. `external_no`
4. `external_hash`

Bu alanlar hedef varlıklarda bulunmalıdır:
1. `caries`
2. `products`
3. `purchase_invoices`
4. `sales`
5. `inventory_movements`
6. `payments`

Idempotency kuralı:
1. `external_system + external_id` kombinasyonu tekrar kayıt üretmemelidir.
2. Tekrar gelen payload için `güncelle` veya `zaten var` davranışı uygulanır.

### 7.14) Entegrasyon İş Kuyruğu ve Log Modeli

`integration_jobs`:
1. `tenant_id`
2. `system` (`logo|mikro|parasut`)
3. `direction` (`inbound|outbound`)
4. `entity_type` (`invoice|product|cari|payment|inventory`)
5. `status` (`queued|processing|success|failed`)
6. `error_message`
7. `payload_json`
8. `created_at`

Kural:
1. Entegrasyon hareketleri izlenebilir olmalı.
2. Başarısız işler yeniden denenebilir olmalı.
3. Kullanıcı panelinde hata/başarı görünürlüğü sağlanmalı.

### 7.15) Dış Alım Faturası Kabul Akışı (Hedef)

1. Dış sistemden gelen alım faturası sistemde `pending_review` kaydedilir.
2. Kullanıcı kabul ettiğinde:
   - stok hareketleri işlenir
   - cari/ürün eşleşmeleri uygulanır
   - gerekirse dış sisteme kabul bilgisi döner
3. Yaşam döngüsü:
   - `draft`
   - `pending`
   - `accepted`
   - `rejected`

### 7.16) Sonraki Adım Kapsamı (Kasa + Tahsilat Çekirdeği)

Bu adımdan sonra detaylandırılacak çekirdek:
1. Kasa hesabı tanımı (şube bazlı)
2. Tahsilat/ödeme hareket türleri
3. Satıştan otomatik tahsilat (varsayılan akış)
4. Veresiye/cari açık kalem yönetimi
5. Gün sonu kasa kapanış akışı

### 7.17) Cari Ekstre (Ledger) Standardı

`ledger_entries` önerilen alanlar:
1. `id`, `tenant_id`, `cari_id`
2. `entry_type` (`debit|credit`)
3. `amount`, `currency`
4. `ref_type`, `ref_id`
5. `branch_id` (nullable)
6. `occurred_at`
7. `due_date` (borç oluşturan satırlarda)
8. `description`
9. `status` (`posted|void`)

İşlem yön standardı:
1. Müşteri için:
   - satış/veresiye kaydı -> `credit`
   - tahsilat -> `debit`
2. Tedarikçi için:
   - alım borcu -> `debit`
   - ödeme -> `credit`

Not:
1. `entry_type` standardı rapor katmanında sabit yorumla kullanılacaktır.
2. Tüm işlemler bu standarda göre otomatik ledger satırı üretmelidir.

### 7.18) Bakiye Hesaplama Kuralları

Ana bakiye kuralı:
1. Cari ana bakiyesi firma genelinde hesaplanır (tüm branch hareketleri dahil).
2. Şube filtresi uygulanırsa sadece ilgili `branch_id` hareketleri hesaplanır.

Formül:
1. Cari bakiye formülü: `toplam_credit - toplam_debit`
2. Pozitif bakiye: cari bize borçlu (alacak)
3. Negatif bakiye: biz cariye borçluyuz (borç)

Durum:
1. `status=void` kayıtlar bakiye hesabına dahil edilmez.
2. Tarih filtresinde yalnız `occurred_at <= filtre_tarihi` kayıtları dikkate alınır.

### 7.19) Branch (Şube) Kırılımı Kuralları

1. `branch_id = NULL` ise hareket firma/merkez kaydıdır.
2. `branch_id` doluysa hareket ilgili şube kaydıdır.
3. Şube kullanıcıları işlem girerken `branch_id` kendi şubesiyle otomatik dolar.
4. Merkez kullanıcıları (Owner/Muhasebe) için `branch_id` opsiyonel olabilir.

UI filtresi:
1. Cari detayında firma geneli bakiye varsayılan gösterilir.
2. İstenirse şube kırılımı filtresi uygulanır.
3. Opsiyonel: `Merkez kayıtlarını dahil et` seçeneği.

### 7.20) Vade, Limit ve Risk Yönetimi

Cari finans alanları:
1. `credit_limit`
2. `term_days`
3. `risk_status` (`normal|watchlist|blocked`)
4. `block_sales_if_over_limit` (bool, varsayılan `true`)

Vade kuralı:
1. Borç oluşturan işlemlerde `due_date` zorunlu veya otomatik hesaplanır.
2. Satış veresiye kaydı için: `due_date = sale_date + term_days`.

Uyarı kuralları:
1. Vadesi geçmiş açık tutar > 0 ise gecikme uyarısı.
2. Kredi limiti aşıldığında limit uyarısı.
3. `risk_status=blocked` ise veresiye/satış engeli uygulanabilir.

### 7.21) Cari Liste ve Detay Göstergeleri (MVP)

Cari listesi kolonları:
1. Ünvan
2. Tip
3. Ana bakiye (firma geneli)
4. Geciken tutar
5. Limit kullanım oranı
6. Durum/risk rozeti

Cari detay sekmeleri:
1. Özet
2. Ekstre (ledger)
3. Tahsilat/Ödeme geçmişi
4. Şube kırılımı

### 7.22) Kasa/Banka Hesap Modeli (Accounts)

`accounts` önerilen alanlar:
1. `id`, `tenant_id`
2. `type` (`cash|bank|pos`)
3. `name`
4. `currency`
5. `branch_id` (nullable)
6. `is_active`

Kural:
1. `branch_id=NULL` hesaplar merkez/firma hesabıdır.
2. `branch_id` dolu hesaplar şube hesabıdır.
3. Şube kullanıcıları yalnız kendi şube hesaplarını görür/kullanır.

### 7.23) Kasa/Banka Bakiye Kuralı

Hesap bakiyesi:
1. `payments` tablosunda `status=posted` kayıtlar dikkate alınır.
2. Hesaba giriş (`direction=in`) tutarları toplanır.
3. Hesaptan çıkış (`direction=out`) tutarları düşülür.
4. Formül: `hesap_bakiye = toplam_in - toplam_out`
5. `status=void` hareketler bakiye hesabına dahil edilmez.

### 7.24) Kasa/Banka UI Akışı (Basit)

Kasa/Banka listesi:
1. Hesap kartları: ad, tip, para birimi, güncel bakiye
2. Bugün giriş/çıkış özeti
3. Aksiyonlar: `Hareket Ekle`, `Ekstre Gör`, `Pasife Al`

Hesap ekstresi:
1. Tarih filtresi
2. Şube filtresi (yetkiye göre)
3. İşlem tipi filtresi (in/out)
4. Satırda: tarih, cari, yöntem, tutar, durum, referans

### 7.25) Tahsilat/Ödeme Hızlı Giriş (Payments)

Tek form akışı:
1. İşlem tipi: `Tahsilat (in)` / `Ödeme (out)`
2. Cari seçimi (telefonla arama + hızlı cari)
3. Tutar
4. Kasa/Banka hesabı
5. Yöntem (`cash|card|transfer|pos`)
6. Not
7. Kaydet

Kural:
1. Kaydet sonrası `payments` kaydı oluşturulur.
2. İlgili cari için otomatik ledger satırı üretilir.
3. Açık kalem varsa FIFO ile kapanış uygulanır.

### 7.26) Kasa/Banka RBAC

Permission key seti:
1. `accounts.view`
2. `accounts.create`
3. `accounts.update`
4. `accounts.deactivate`
5. `accounts.statement.view`
6. `payments.create`
7. `payments.void`
8. `payments.view`

Varsayılan scope:
1. Merkez muhasebe: `entire_company`
2. Şube operasyon: `assigned_branch`

### 7.27) Alım Faturası ile Stok Giriş Akışı

Amaç:
1. Oluşturulmuş cari üzerinden alım yapıp stoklara güvenli ve hızlı giriş sağlamak.
2. Seri/IMEI/ICCID takipli ürünlerde barkod okuyucu destekli girişi standartlaştırmak.

Yaşam döngüsü:
1. `draft`
2. `pending_approval` (opsiyonel)
3. `approved`
4. `cancelled`

Kural:
1. Stok ve cari etkisi yalnız `approved` anında oluşur.
2. `draft` aşamasında kayıtlar düzenlenebilir, stok etkisi yoktur.
3. Onay mekanizması zorunlu standarttır (kurumsal güvenlik için).
4. Küçük işletmeler için tenant ayarıyla `kaydederken onayla` (hızlı onay) açılabilir.
5. Hızlı onay açık olsa da teknik olarak işlem yine `approved` adımı üzerinden çalışır.
6. Onay akışı tek DB transaction ile çalışır; stok + ledger + durum birlikte yazılır.
7. Transaction içindeki adımlardan biri hata verirse hiçbir etki kalıcı olmaz (rollback).

Alım faturası başlık alanları:
1. Cari seçimi (`cari_code` veya cari adı ile arama)
2. Fatura no
3. Fatura tarihi
4. Alış tarihi
5. Şube/depo
6. Para birimi
7. Ödeme tipi (opsiyonel)
8. Not

Satır alanları:
1. Ürün (SKU/ad/barkod ile arama)
2. Adet
3. Alış fiyatı
4. Satış fiyatı (opsiyonel/tenant kuralına göre zorunlu)
5. KDV
6. İskonto (opsiyonel)

Ürün yoksa akış:
1. Satırdan çıkmadan inline `Yeni Ürün Kartı` açılır.
2. Ürün kartı kaydedildikten sonra satıra otomatik bağlanır.

Seri ve barkod hızlı giriş:
1. Barkod okuyucu ile ürün barkodu okutulabilir.
2. `tracking_type=serial|imei|iccid` ürünlerde seri girişi zorunludur.
3. Seri girişi yöntemleri:
   - tek tek okutma
   - toplu yapıştırma (satır başına bir seri)
4. Kural: seri sayısı = satır adedi.
5. Duplicate seri/IMEI/ICCID girişine izin verilmez.

Onay (`approved`) anında otomatik işlemler:
1. `purchase_invoices` onay kaydı oluşur.
2. `inventory_movements` inbound kayıtları oluşur.
3. Serisiz ürünlerde `inventory_items.quantity` artırılır.
4. Serili ürünlerde `inventory_units` oluşturulur (`status=in_stock`).
5. Tedarikçi cari için ledger borç kaydı oluşturulur.
6. Ürün `last_cost_price` değeri güncellenir.
7. Opsiyonel ayar: satış fiyatı güncelleme önerisi/uygulaması.

İptal (`cancelled`) anında otomatik işlemler:
1. Onaylı fatura iptal edilirse ters stok hareketleri oluşturulur.
2. Cari ledger tarafında ters kayıt üretilir.
3. İptal işlemi için `purchase.cancel` yetkisi zorunludur.
4. İptal metadata alanları tutulur: `cancelled_by`, `cancelled_at`.

Validasyon kuralları:
1. Cari aktif olmalıdır.
2. Ürün aktif olmalıdır.
3. Seri zorunlu ürünlerde eksik seri varsa onaya izin verilmez.
4. Onay sonrası kritik alanlar (seri, adet, fiyat) doğrudan değiştirilemez.
5. Düzeltme ihtiyacında iptal + yeni belge akışı kullanılır.
6. Onay aşamasında seri tekrar kontrolü zorunludur (duplicate engeli).
7. Satır miktarı ile seri adedi eşleşmiyorsa onay bloklanır.

UI prensibi:
1. Tek ekranda başlık + satır + canlı özet.
2. `Barkod Modu` hızlı giriş paneli bulunur.
3. Sağ özet panelinde:
   - toplam satır
   - toplam tutar
   - eksik seri uyarısı

Liste ekranı (MVP):
1. Fatura No
2. Cari
3. Tarih
4. Şube
5. Toplam
6. Durum (`draft|pending_approval|approved|cancelled`)
7. Onaylayan kullanıcı

Audit ve entegrasyon alanları:
1. `approved_by`, `approved_at`
2. `cancelled_by`, `cancelled_at`
3. `external_system`, `external_id`

### 7.28) Alım Faturası İçe Aktar (Import) Standardı

Alım faturası satır girişinde üç yöntem desteklenir:
1. Barkod/seri ile hızlı ekleme
2. Manuel satır ekleme
3. Şablonla içe aktar

Import şablon yapısı (2 veri dosyası):
1. `Fatura Satırları` şablonu:
   - `supplier_code` veya `supplier_name` (opsiyonel)
   - `invoice_no` (opsiyonel)
   - `invoice_date` (opsiyonel)
   - `branch_code` (opsiyonel)
   - `product_sku` veya `barcode` veya `product_name` (en az biri zorunlu)
   - `quantity` (zorunlu)
   - `purchase_price` (zorunlu)
   - `sale_price` (opsiyonel)
   - `vat_rate` (opsiyonel)
2. `Seri Listesi` şablonu:
   - `product_sku` veya `barcode` (zorunlu)
   - `unit_code` (zorunlu: IMEI/ICCID/Serial)
   - `purchase_price` (opsiyonel)
   - `sale_price` (opsiyonel)

Şablon dosya standardı:
1. Şablonda `Açıklama` sayfası bulunur.
2. `Açıklama` sayfasında:
   - alanların anlamı
   - zorunlu/opsiyonel alan işaretleri
   - örnek kullanım
   - format kuralları
3. Şablonda referans listeleri bulunur:
   - kategori listesi
   - marka listesi
4. Şablon hem basit hızlı giriş hem detaylı opsiyonel alanları destekler.

Import işlem akışı:
1. Dosya yükle
2. Önizleme ve validasyon
3. Satır eşleştirme / ürün çözümleme
4. Onayla ve taslağa aktar

Kritik karar:
1. Ürün bulunamadığında otomatik ürün oluşturma yapılmaz.
2. Kullanıcı onayı zorunludur:
   - `Yeni ürün oluştur` (mini form)
   - `Mevcut ürünle eşleştir`
   - `Satırı atla`

Validasyon kuralları:
1. Seri ürünlerde seri adedi = satır miktarı olmalıdır.
2. Duplicate seri/IMEI/ICCID engellenir.
3. Sistemde mevcut seri ile çakışma varsa satır hataya düşer.
4. Hatalı satırlar raporlanır ve indirilebilir.

Onaylı akış uyumu:
1. Import işlemi yalnız `draft` faturayı doldurur.
2. Stok/cari etkisi oluşturmaz.
3. `approved` aşamasında tüm kritik validasyonlar tekrar çalışır.

### 7.29) Alım Faturası Eşleştirme (Match & Merge)

Amaç:
1. Entegrasyon + manuel girişte mükerrer fatura oluşumunu engellemek.
2. Stok ve cari etkilerinin ikinci kez yazılmasını önlemek.

Fatura eşleştirme alanları:
1. `source_system` (`alpi360|integration`)
2. `external_system`, `external_id`
3. `matching_status` (`none|matched|conflict`)
4. `matched_invoice_id` (nullable)

Olası eşleşme anahtarları:
1. `supplier_id + invoice_no + invoice_date + total_amount`
2. Varsa `external invoice uuid/id` (öncelikli)

Kullanıcı aksiyonları:
1. `Eşleştir` (merge)
2. `Entegrasyon kaydını ana kaynak yap`
3. `Ayrı tut` (yalnız yetkili rol)

Güvenlik kuralları:
1. Eşleşen faturalarda stok/cari etkisi tekrar çalıştırılamaz.
2. İki kayıt da `approved` ise otomatik birleştirme yapılmaz; önce biri iptal edilmelidir.
3. Eşleştirme işlemleri audit log'a yazılır.

## 8) Stok Operasyonu Sabitleri

1. Her stok değişimi mutlaka belgeye bağlı hareket üretir.
2. Transfer yaşam döngüsü sabit:
   - `Draft` (etkisiz)
   - `Shipped` (kaynak stok azalır, in_transit)
   - `Received` (hedef stok artar)
3. Sayım sırasında depo kilidi uygulanır; sonuç farkları adjustment belgesine yazılır.

Seri yaşam döngüsü kuralı:
1. Alımda seri kaydı `in_stock` açılır.
2. Transferde aynı seri kaydı branch değiştirir (yeni seri kaydı açılmaz).
3. Satışta seri durumu `sold` olur.
4. İadede politika dahilinde `returned` veya tekrar `in_stock` durumuna alınır.
5. Seri kaydı silinmez; yaşam döngüsü statü güncellemesiyle izlenir.

### 8.1) Uygulama Sırası (Satış Öncesi Zorunlu)

Satış giriş ekranına geçmeden önce aşağıdaki stok akışları tamamlanmalıdır:
1. Stok giriş akışı (alım/manüel giriş)
2. Şubeler arası transfer akışı
3. Sayım ve varyans (fark) yönetimi

Gerekçe:
1. Satış ekranı IMEI/ICCID/seri ve şube stok verisine doğrudan bağımlıdır.
2. Stok omurgası tamamlanmadan satışta veri tutarsızlığı riski oluşur.

### 8.2) Stok Hareket Veri Modeli (Inventory Movements)

`inventory_movements` önerilen alanlar:
1. `id`, `tenant_id`
2. `movement_type` (`purchase_in|sale_out|transfer_out|transfer_in|return_in|return_out|adjustment_in|adjustment_out|count_adjustment`)
3. `product_id`
4. `quantity`
5. `from_branch_id` (nullable)
6. `to_branch_id` (nullable)
7. `ref_type`, `ref_id`
8. `occurred_at`
9. `status` (`draft|posted|void`)

Kural:
1. Her stok değişimi mutlaka `inventory_movements` kaydı üretir.
2. `posted` olmayan hareketler stok bakiyesine yansımaz.

### 8.3) Transfer Akışı (Şubeler Arası)

Transfer lifecycle:
1. `draft`
2. `shipped`
3. `received`
4. `cancelled`

Davranış:
1. `draft`: stok etkisi yok
2. `shipped`: kaynak şubede stok düşer, seri durumu `in_transit` olur
3. `received`: hedef şubede stok artar, seri durumu `in_stock` olur
4. `cancelled`: transfer kapanır, gerekli ters kayıtlar oluşur

UI (MVP):
1. Kaynak şube, hedef şube, ürün/seri seçimi
2. Seri ürünlerde okutma/yapıştırma desteği
3. `Gönder` ve `Teslim Al` aksiyonları rol bazlı ayrılır

### 8.4) Sayım ve Varyans (Fark) Yönetimi

Sayım süreci:
1. Sayım başlat (`draft`)
2. Sayım girişleri (barkodlu/serili)
3. Kontrole gönder (`submitted`)
4. Uygula (`approved`) veya sadece raporla (`reported`)
5. İptal (`cancelled`)

Kural:
1. Sayım başlatıldığında ilgili depo `kilitli sayım modu`na alınır.
2. Kilitli depoda satış/transfer/alım/manüel stok hareketi engellenir.
3. Sayım onayında farklar `adjustment_in/out` hareketleriyle stoklara uygulanır.
4. Sayım iptal edilirse stok etkisi oluşmaz, depo kilidi kaldırılır.
5. Sayım farkı manuel stok güncellemesi yerine belge bazlı hareket üretmelidir.

Sayım türleri:
1. Tam sayım (`full`)
2. Kısmi sayım (`partial`)
3. Kısmi kapsam seçenekleri: kategori, marka, ürün, serili/serisiz

Sayım kayıt alanları:
1. `count_no`
2. `branch_id` / `warehouse_id`
3. `count_type` (`full|partial`)
4. `scope_definition` (partial kapsam)
5. `started_by`, `submitted_by`, `approved_by`
6. `started_at`, `submitted_at`, `approved_at`
7. `status` (`draft|submitted|approved|reported|cancelled`)

Kontrol ekranı:
1. Sistem stok vs sayım adedi karşılaştırması
2. Fark (+/-) ve fark maliyet değeri
3. Serili ürünlerde eksik/fazla seri listesi
4. Aksiyon:
   - `Sadece Raporla`
   - `Farkı Uygula`

### 8.5) Seri Ürün Hareket Takibi

1. Seri ürünlerde hareketler `inventory_units` üzerinden izlenir.
2. Her seri için güncel durum + güncel branch bilgisi tutulur.
3. Hareket geçmişi `ref_type/ref_id` ile belgeye bağlanır.
4. Satılmış seri yeni giriş gibi tekrar eklenemez; yalnız iade/ters işlem akışıyla geri döner.

### 8.6) Stok Hareket RBAC

Permission key seti:
1. `inventory.view`
2. `inventory.movement.create`
3. `inventory.transfer.create`
4. `inventory.transfer.ship`
5. `inventory.transfer.receive`
6. `inventory.count.create`
7. `inventory.count.approve`
8. `inventory.adjustment.create`

Varsayılan scope:
1. Şube operasyonu: `assigned_branch`
2. Merkez operasyonu/muhasebe: `entire_company`

### 8.7) Transfer Yaşam Döngüsü

MVP transfer lifecycle:
1. `draft`
2. `approved`
3. `cancelled`

Opsiyonel ileri seviye lifecycle:
1. `in_transit`
2. `received`
3. `partially_received`
4. `disputed`

Kural:
1. Transfer sevk edildiğinde ürünler `in_transit` olur.
2. Hedef şube `received` onayı vermeden stoklar hedefte satılabilir stok olarak görünmez.
3. Kısmi teslim desteklenir; teslim alınmayan miktar/seri `in_transit` kalır.
4. Eksik/uyuşmazlık durumunda `disputed` akışı açılabilir.

### 8.8) Transfer UI Akışı (Liste + 3 Adım Wizard)

Transfer listesi:
1. Filtreler: tarih, kaynak şube/depo, hedef şube/depo, durum, ürün/seri arama
2. Kolonlar: tarih, transfer no, kaynak->hedef, satır sayısı, durum, oluşturan/onaylayan

Yeni transfer wizard:
1. Adım 1 - Başlık:
   - kaynak şube/depo
   - hedef şube/depo
   - sevk tarihi
   - açıklama
2. Adım 2 - Ürün satırları:
   - barkod ile ekle
   - ürün arama ile ekle
   - opsiyonel import (v2)
3. Adım 3 - Özet ve onay:
   - toplam satır/adet
   - seri kontrolleri
   - taslak kaydet / onaya gönder / onayla

### 8.9) Transfer Onay Kuralları (Transaction)

`approved` anında tek transaction:
1. Serisiz ürün:
   - kaynak stok `-qty`
   - transfer edilen miktar `in_transit` olarak işaretlenir
2. Serili ürün:
   - sevk edilen seri kayıtları `in_transit` statüsüne alınır
   - `inventory_unit_moves` kaydı yazılır
3. `inventory_movements` belgeye bağlı satırlar `posted` olur.

`received` / `partially_received` anında:
1. Serisiz ürün:
   - teslim alınan miktar hedef stoğa `+` yazılır
   - kalan miktar `in_transit` olarak tutulur
2. Serili ürün:
   - sadece teslim alınan seri kayıtları hedef depoya taşınır (`status=in_stock`)
   - teslim alınmayan seriler `in_transit` kalır

### 8.10) Transfer Hata ve İptal Kuralları

Hata önleme:
1. Serisizde yetersiz stokta onay engellenir.
2. Serilide seçilen seri kaynak depoda değilse onay engellenir.
3. Aynı transferde aynı seri iki kez seçilemez.
4. `approved` transfer düzenlenemez.
5. `in_transit` veya `partially_received` seri satış ekranında seçilemez.

İptal:
1. `approved` transfer iptalinde ters hareket (reverse transfer) oluşturulur.
2. Seri ürünler eski depoya geri taşınır.
3. İptal işlemi audit log'a yazılır.

Uyuşmazlık:
1. Teslim alan şube eksik/hasarlı/yanlış ürün için `disputed` bildirimi açabilir.
2. Uyuşmazlık nedeni zorunludur.
3. Çözüm opsiyonları:
   - kalanların sonradan teslimi
   - eksiklerin kayıp/fire hareketiyle kapatılması (yetkili onayı)
   - yeni transfer ile tamamlama

### 8.11) Transfer RBAC

Permission key seti:
1. `inventory.transfer.create`
2. `inventory.transfer.approve`
3. `inventory.transfer.cancel`
4. `inventory.view`

Varsayılan rol davranışı:
1. Şube rolleri: oluşturma (kendi şubesi)
2. Merkez rolleri: tüm şubelerde onay/iptal

### 8.12) Transfer UI Ergonomisi (Mobil/Tablet)

1. Barkod okutma alanı büyük ve sürekli odaklı olmalıdır.
2. Seri seçme/okutma ekranı full-screen modal çalışmalıdır.
3. Tek tuşla `Onaya Gönder` aksiyonu bulunmalıdır.

### 8.13) Transfer Teslim Alma Ekranı (Kısmi Teslim)

Ekran özet kartı (her iki taraf için görünür):
1. Gönderilen
2. Teslim Alınan
3. Yolda (`in_transit`)
4. Eksik/Uyuşmazlık durumu

Satır bazlı teslim:
1. Serisiz üründe teslim alınan adet girilir.
2. Serili üründe teslim alınanlar seri okutarak seçilir.
3. Kural: serili ürünlerde teslim adedi = okutulan seri sayısı.

Aksiyonlar:
1. `Kısmi Teslim Kaydet`
2. `Tam Teslim Al`
3. `Uyuşmazlık Bildir`

Bildirim:
1. Gönderen şube, hedefin kısmi/tam teslim durumunu bildirim olarak görür.

### 8.14) Transfer Numaralandırma ve Entegrasyon

Numaralandırma:
1. Format: `TRF-YYYY-######`
2. Tenant içinde unique olmalıdır.

Entegrasyon:
1. Transfer Alpi 360 operasyonel modülüdür; External Accounting'de de aktif çalışır.
2. İstenirse dış sisteme transfer fişi export/push edilebilir (opsiyonel).

### 8.15) Transfer Veri Alanları (Kısmi Teslim İçin)

Transfer başlığı:
1. `shipped_at`, `shipped_by`
2. `received_at`, `received_by` (tam teslimde)
3. `received_status` (`none|partial|full`)

Transfer satırı:
1. `qty_shipped`
2. `qty_received`
3. `qty_in_transit` (hesaplanan veya saklanan)

Serili satırlar:
1. sevk edilen unit listesi
2. teslim alınan unit listesi

### 8.16) Şube Dashboard "Bekleyen Transferler" Kartı

Şube dashboard'unda zorunlu kart:
1. `Bekleyen Transferler` toplamı
2. `Kısmi Teslim` sayısı
3. En eski bekleyen transfer süresi

Kart içeriği (mini liste, en fazla 3 satır):
1. Transfer No
2. Gönderen şube
3. Gönderilen toplam
4. Durum özeti (`yeni`, `kısmi`)

Aksiyon:
1. `Tümünü Gör` ile transfer listesine geçiş.
2. Kart tıklamasıyla bekleyen transferler ekranı açılır.

### 8.17) Teslim Alma Ekranı (Final UI Akışı)

Üst özet paneli:
1. Gönderen şube
2. Gönderilen toplam
3. Teslim alınan toplam
4. Yolda kalan toplam
5. Durum rozeti (`in_transit`, `partially_received`, `received`)

Satır alanı:
1. Ürün
2. Gönderilen miktar
3. Teslim alınan miktar
4. Kalan miktar

Serili satır davranışı:
1. `Seri Okut` aksiyonu bulunur.
2. Okutulan seriler listelenir.
3. Eksik seriler görsel olarak işaretlenir.
4. Serili ürünlerde teslim miktarı okutulan seri sayısından hesaplanır.

Ekran aksiyonları:
1. `Kısmi Teslim Kaydet`
2. `Tamamını Teslim Al`
3. `Uyuşmazlık Bildir`

Güvenlik ve stok görünürlüğü:
1. `in_transit` ürün kaynakta satılamaz.
2. `in_transit` ürün hedefte satılabilir stok olarak görünmez.
3. Teslim alındığında hedefte `in_stock` olur ve satışa açılır.

Bildirim:
1. Kısmi teslimde gönderen şubeye teslim oranı bildirilir.
2. Tam teslimde gönderen şubeye tamamlandı bildirimi gönderilir.

### 8.18) Stok Görüntüleme Modülü (Özet + Seri + Sorgu)

Stok görüntüleme 3 ana ekrandan oluşur:
1. Stok Özeti (adet bazlı)
2. Seri Stok (IMEI/ICCID/Serial bazlı)
3. Ürün/Seri Sorgulama (scan & search)

Global filtre barı:
1. Şube (tümü/seçili)
2. Depo
3. Arama (ürün adı/SKU/barkod/seri)

Stok Özeti ekranı:
1. Kolonlar: ürün, SKU, kategori, marka, tracking, toplam stok, şube stoku, durum
2. Satır drawer:
   - şube bazlı dağılım
   - son stok hareketleri
   - serili ürünlerde seri listesi geçişi

Seri Stok ekranı:
1. Kolonlar: unit_code, ürün, lokasyon, durum, son hareket, kaynak belge
2. Durum filtreleri: `in_stock|in_transit|sold|reserved|scrapped`
3. Seri detayında hareket timeline gösterilir.

Ürün/Seri sorgulama ekranı:
1. Barkod/IMEI/ICCID/SKU ile tek alandan arama
2. Seri aramasında:
   - ürün bilgisi
   - güncel durum
   - lokasyon
   - belge geçmişi
3. Ürün aramasında:
   - stok özeti
   - şube dağılımı
   - seri listesi (varsa)

Görünürlük kuralı:
1. Varsayılan görünüm firma geneli.
2. Şube seçilirse şube kırılımı uygulanır.
3. `in_transit` stok ayrı gösterilir, satışa dahil edilmez.

## 9) Paketleme ve Feature Gating

1. Permission listesi paket seviyesine göre filtrelenir.
2. Paketler: Basic / Pro / Enterprise.
3. Custom scope ve gelişmiş yetki özellikleri paket bazlı açılır.

## 10) V1'e Dahil / V1 Dışı

V1'e dahil:
1. Faz 1-5'in çekirdek kapsamı
2. Subdomain/tenant altyapısı
3. Rol-scope-yetki hiyerarşisi
4. HR kartı + kullanıcı davet akışı
5. Ürün/kategori/marka + stok temel işlemleri
6. Ön muhasebe temel işlemleri
7. Transfer/sayım çekirdeği
8. Abonelik limiti ve read-only kuralları

V1 dışı (V2):
1. Prim/KPI kural motoru
2. Dış muhasebe derin entegrasyon paketleri
3. Gelişmiş raporlama ve mobil uygulama

## 11) Uygulama Başlangıç Kriteri

Kodlamaya başlamadan önce şu artefaktlar netleşmiş olmalıdır:
1. Rol x Modül x Aksiyon x Scope matrisi (seed dahil)
2. Veritabanı şema taslağı (`users`, `roles`, `permissions`, `role_permissions`, `user_roles`, `user_branches`, `audit_logs`, tenant ve branch tabloları)
3. Yetki kontrol middleware sözleşmesi
4. Audit log olay sözlüğü
5. Seed stratejisi (varsayılan rol ve modül izinleri)

### 11.1) Quota ve Branch İçin Minimum Şema Alanları

`tenants`:
1. `id`
2. `name`
3. `subdomain`
4. `package_id`
5. `status`
6. `max_branches` (`NULL`/`-1` = unlimited)
7. `max_active_users` (`NULL`/`-1` = unlimited)
8. opsiyonel `max_employees` (`NULL`/`-1` = unlimited)
9. `subscription_start_date`
10. `subscription_end_date`
11. `subscription_status`
12. `grace_period_days` (opsiyonel)
13. `auto_renew` (opsiyonel)
14. `billing_email`
15. `created_at`

`branches`:
1. `id`
2. `tenant_id`
3. `region_id` (nullable)
4. `name`
5. `code` (tenant içinde unique)
6. `address`
7. `phone`
8. `is_active`
9. `created_at`

`subscription_notifications`:
1. `id`
2. `tenant_id`
3. `type` (`D30`, `D14`, `D7`, `D3`, `D1`, `EXPIRE`, `POST1`, `POST3`)
4. `sent_in_app` (bool)
5. `sent_email` (bool)
6. `sent_platform` (bool)
7. `sent_at`

`features`:
1. `id`
2. `key` (örn `hr`, `accounting`, `inventory`)
3. `name`
4. `description`
5. `is_active`

`plans`:
1. `id`
2. `name` (Basic/Pro/Enterprise)
3. `is_active`
4. `max_branches`
5. `max_active_users`

`plan_features`:
1. `plan_id`
2. `feature_id`
3. `is_enabled`

`tenant_features`:
1. `tenant_id`
2. `feature_id`
3. `mode` (`inherit`, `enable`, `disable`)

`roles` (minimum ek alanlar):
1. `id`
2. `tenant_id`
3. `name`
4. `is_system` (bool)
5. `is_protected` (bool)
6. `is_editable` (bool)
7. `is_active` (bool)

`role_assignment_rules`:
1. `tenant_id`
2. `assigner_role_id`
3. `assignable_role_id`

Not:
1. Tenant yönetiminde rol yetkileri varsayılan olarak düzenlenebilir (`is_editable=true`).
2. `Firma Sahibi` için güvenlik kısıtları ayrıca iş kuralıyla korunur (pasife alma/atanma).

## 12) Proje Özeti (Mevcut Durum)

### 12.1) SaaS Platform Mimarisi
1. Multi-tenant yapı: her firma ayrı tenant.
2. Veri izolasyonu: `tenant_id` zorunlu.
3. Subdomain modeli: `firmaa.seninapp.com`.

### 12.2) Abonelik ve Limit Sistemi
1. Tenant abonelik alanları: başlangıç/bitiş, durum, grace period.
2. Limit alanları: `max_branches`, `max_active_users` (unlimited destekli).
3. Süre dolunca davranış: giriş var, yazma işlemleri yok (`read-only`).
4. Uyarılar üç kanalda üretilir: platform paneli, tenant banner, e-posta.
5. Hatırlatma eşikleri: `T-30`, `T-14`, `T-7`, `T-3`, `T-1`, `T-0`, `POST-1`, `POST-3`.

### 12.3) Rol ve Yetki Mimarisi
1. Resource bazlı permission modeli kullanılır.
2. Scope bazlı erişim zorunludur: `entire_company`, `assigned_region`, `assigned_branch`, `self_record`, `custom_scope`.
3. Firma özel rol oluşturabilir; güvenlik sınırları korunur.
4. `1 kullanıcı = 1 aktif rol` kuralı geçerlidir.
5. Rol atama güvenliği `role_assignment_rules` ile yönetilir.

### 12.4) Organizasyon Yapısı
1. Katmanlar: Tenant > Region (opsiyonel) > Branch > Department.
2. Kullanıcı çoklu branch ataması alabilir.
3. Primary branch kavramı zorunludur.
4. Branch pasiflenebilir.

### 12.5) Şube Yönetimi
1. Şube kodu manuel ve tenant içinde unique'dir.
2. Şube oluşturma sırasında aktif mağaza limiti kontrol edilir.
3. Şube pasifleştirme wizard'ı ile personel/kullanıcı kaydırma yapılır.
4. Primary branch ve aktif şube kalmama senaryoları kural bazlı yönetilir.
5. Audit log zorunludur.
6. Şube kurulumunda setup durumu kullanılır: `not_started`, `in_progress`, `completed`.

### 12.6) Personel Modülü (HR Core)
1. Sabit alanlar zorunludur; dinamik alanlar tenant admin tarafından yönetilir.
2. Dinamik alanlarda silme yerine pasife alma uygulanır.
3. Personel kaydından login hesabına geçiş davet akışıyla yapılır.
4. Aktif kullanıcı limitleri uygulanır.

### 12.7) Kullanıcı Yaşam Döngüsü
1. Durumlar: `invited`, `active`, `suspended`, `terminated`.
2. Hard delete yoktur; audit log zorunludur.

### 12.8) Güvenlik Katmanları
1. Backend permission middleware.
2. Scope JSON rule engine.
3. Read-only middleware.
4. Audit log.
5. Subscription notification log.

### 12.9) Sistem Seviyesi
1. Zincir mağaza ve franchise operasyonları desteklenir.
2. Bölge müdürlüğü ve çok katmanlı rol yapısı desteklenir.
3. Limitli SaaS satış modeli desteklenir.
4. Abonelik süre ve hatırlatma yönetimi desteklenir.
5. Personel dinamik alan ve scope bazlı veri güvenliği desteklenir.

## 13) UI/UX Ürün Standardı (Zorunlu)

Bu proje kurumsal görünümde, modern teknoloji standardında ve günlük kullanımda basit olmalıdır.

### 13.1) Temel UX İlkeleri

1. Öncelik: kullanım kolaylığı, hız ve hata önleme.
2. Birincil işlemler en fazla 1-2 tıkta erişilebilir olmalıdır.
3. Formlar adım adım (wizard) ve açık yönlendirme metinleriyle ilerlemelidir.
4. Teknik terimler yerine operasyon dili kullanılmalıdır.
5. Kritik işlemlerde (pasife alma, onay, kapanış) net onay ekranı zorunludur.

### 13.2) Modern UI Standardı

1. Tasarım sistemi (design system) kullanılacaktır:
   - renk tokenları
   - tipografi ölçeği
   - boşluk/grid standardı
   - ortak bileşen kütüphanesi
2. Tüm ekranlar responsive olmalıdır (desktop + tablet + mobil).
3. Erişilebilirlik (a11y) minimum standardı:
   - klavye ile gezinme
   - yeterli kontrast
   - form hata mesajlarının açık gösterimi
4. Yüksek yoğunluklu ERP ekranları için:
   - tablo filtreleri
   - hızlı arama
   - kolon özelleştirme (opsiyonel)
   - sabit aksiyon alanı

### 13.3) Kullanım Basitliği Kuralları

1. Karmaşık yapılandırmalar varsayılanlarla hazır gelmelidir (seed-first).
2. Yeni tenant ilk girişte kurulum sihirbazı ile yönlendirilmelidir.
3. Rol, şube, personel, satış gibi ana akışlarda boş durum ekranları rehberli olmalıdır.
4. Hata mesajları aksiyon odaklı olmalıdır:
   - ne oldu
   - neden oldu
   - nasıl düzeltilir

### 13.4) Performans ve Algılanan Hız

1. Liste ekranları sayfalama ve server-side filtre ile çalışmalıdır.
2. Kullanıcıya her işlemde geri bildirim verilir:
   - loading
   - success
   - error
3. Uzun süren işlemler için progress veya durum bildirimi zorunludur.

### 13.5) Güven ve Şeffaflık

1. Kullanıcının erişemediği modüller açıkça paket bilgisiyle belirtilir.
2. Read-only mod, banner ve kilitli butonlarla net hissettirilir.
3. Audit etkisi olan işlemlerde kullanıcıya işlem kaydı tutulduğu belirtilir.

---

Durum: Bu dokümandaki maddeler V1 için "sabit karar" kabul edilmiştir. Değişiklikler yalnızca versiyonlanmış karar kaydı ile yapılır (ör. `ADR-00X`).

## 14) Teknik Mimari ve Altyapı Standardı

### 14.1) V1 Teknoloji Seçimleri (Sabit)

1. Frontend: `Next.js 14 + TypeScript`
2. UI: `Tailwind CSS + shadcn/ui`
3. Backend: `Supabase (PostgreSQL + Auth + Edge Functions + Realtime)`
4. Cache: `Redis (Upstash)`; yetki/scope cache ve rate-limit için
5. Dosya depolama: `Supabase Storage` (import/export, görseller)
6. Deployment: `Vercel (frontend) + Supabase Cloud (backend/data)`

### 14.2) Katman ve Çalışma Modeli

1. Başlangıç mimarisi: modüler monolith.
2. Büyüme hedefi: domain bazlı servis ayrışmasına hazır tasarım.
3. Sunum katmanı: App Router + drawer-first akış.
4. API katmanı: Edge Functions + RPC + REST hibrit.
5. İş mantığı: transaction bazlı atomik operasyon.
6. Güvenlik zinciri: `subscription -> feature -> permission -> scope -> data`.

### 14.2.1) Ortam ve Domain Topolojisi

1. Platform paneli domaini: `admin.alpi360.com`
2. Tenant paneli domaini: `{firma}.alpi360.com`
3. Tenant çözümleme App Router middleware katmanında yapılır.
4. Tenant kimliği çıkarılamayan istekler uygulama katmanına alınmadan reddedilir.

### 14.3) Güvenlik ve İzolasyon

1. Tüm tenant verilerinde `tenant_id` zorunlu.
2. Supabase RLS tüm kritik tablolarda aktif.
3. Middleware ve RLS birlikte çalışır (çift katman).
4. Redis scope cache TTL: 5 dakika; rol/yetki değişiminde invalidate zorunlu.
5. Tüm yazma işlemleri audit log üretir.

### 14.4) Veri Tasarım Kuralları (Ek)

1. `branch_id` nullable: `NULL = merkez`, dolu = şube.
2. Soft delete öncelikli yaklaşım; hard delete istisna ve kural bazlı.
3. Seri takipli birimlerde tenant içi unique: `UNIQUE(tenant_id, unit_code_normalized)`.
4. Maliyet yaklaşımı: ağırlıklı ortalama maliyet (WAC) varsayılan.
5. Para birimi: V1 varsayılan TRY; tablo yapıları `currency_code` genişlemeye açık.
6. Temel sorgular için composite index stratejisi zorunlu: `tenant_id + domain_key` (örn. `tenant_id + sku`, `tenant_id + unit_code`, `tenant_id + created_at`).

### 14.5) Çekirdek Tablo Grupları (Referans)

1. Platform/Tenant: `tenants`, `subscription_packages`, `tenant_modules`
2. Organizasyon: `regions`, `branches`, `departments`, `positions`
3. Yetki: `users`, `roles`, `permissions`, `role_permissions`, `user_branches`
4. HR: `employees`, `employee_custom_fields`, `employee_custom_field_values`
5. Katalog: `categories`, `brands`, `products`
6. Stok: `inventory_items`, `inventory_units`, `inventory_documents`, `inventory_document_lines`, `inventory_unit_moves`
7. Finans: `contacts/caries`, `ledger_entries`, `accounts`, `payments`, `payment_allocations`
8. Satış: `sales`, `sale_lines`, `sale_serial_items`
9. Fiyat/Prim: `price_rules`, `effective_price_cache`
10. KPI/Prim: `kpi_definitions`, `kpi_targets`, `kpi_actuals`, `commission_rules`, `commission_calculations`, `commission_ledger`
11. Entegrasyon: `external_integrations`, `integration_jobs`, `integration_mappings`
12. Sistem: `audit_logs`, `error_logs`, `notifications`

## 15) Hata Kodu ve Operasyonel Log Standardı

### 15.1) Format

1. Standart format: `ALPI-<MODUL>-<KATEGORI>-<NUMARA>`
2. Örnek: `ALPI-TRNS-STAT-091`
3. Hata kodu tüm API cevaplarında ve sistem loglarında taşınır.

### 15.2) Kategori Sözlüğü

1. `VAL`: validasyon
2. `NOTF`: bulunamadı
3. `CON`: çakışma/duplicate
4. `STAT`: durum/lifecycle ihlali
5. `PERM`: yetki ihlali
6. `LIM`: limit/plan ihlali
7. `LOCK`: kilitli kaynak
8. `INT`: entegrasyon hatası
9. `IO`: dosya/girdi-çıktı hatası

### 15.3) Modül Kısaltmaları (Örnek Set)

1. `AUTH`, `PERM`, `TEN`, `BRCH`, `WH`, `CATA`, `BRND`, `PROD`
2. `INVT`, `SERIAL`, `PURC`, `TRNS`, `CNT`, `PRIC`, `INTE`, `FILE`, `SYS`

### 15.3.1) Numara Aralıkları (V1 Standardı)

1. `001-010`: kimlik doğrulama ve temel validasyon
2. `011-020`: bulunamadı (`NOTF`) sınıfı
3. `021-030`: çakışma (`CON`) sınıfı
4. `031-040`: durum/lifecycle (`STAT`) sınıfı
5. `041-060`: yetki (`PERM`) sınıfı
6. `061-075`: limit/paket (`LIM`) sınıfı
7. `076-100`: kilit/entegrasyon/IO (`LOCK`, `INT`, `IO`) sınıfı

### 15.4) Log Zorunlulukları

1. `correlation_id` her hatada zorunlu.
2. Kullanıcıya gösterilen mesaj ve geliştirici mesajı ayrı tutulur.
3. Hata kaydı ekran/endpoint bilgisi taşır.
4. Her kod için kısa çözüm önerisi bulunur.

## 16) Faz Bazlı Uygulama Todo Matrisi (Güncel)

Faz geçiş kuralı: Kritik maddeler tamamlanmadan bir sonraki faza geçilmez.

### 16.1) Faz 1 - Platform ve Altyapı

1. Super Admin paneli: tenant oluşturma, paket ve limit atama
2. Multi-tenant izolasyon + RLS
3. Subdomain yönlendirme ve tenant çözümleme
4. Abonelik ve hatırlatma job akışı
5. Read-only middleware
6. Template/seed kurulum akışı
7. RBAC (permission + scope + assignment policy)
8. Data Visibility Layer (rapor güvenlik katmanı)
9. Redis scope cache (TTL + invalidate)
10. Audit log ve hata kod altyapısı
11. Organizasyon yapısı (bölge/şube/departman/pozisyon)
12. Şube açılışında otomatik kasa + depo
13. Kullanıcı davet akışı + çoklu şube atama

### 16.2) Faz 2 - HR, Kategori, Marka, Ürün

1. Personel kartı (sabit + dinamik alanlar)
2. Personel -> user davet akışı
3. Kategori hiyerarşisi ve davranış bayrakları
4. Marka yönetimi (kullanım kontrollü soft delete)
5. Ürün kartı (SKU unique, tracking, fiyat/KDV)
6. Ürün import wizard + hata raporu
7. Personel görev/şube geçmişi

### 16.3) Faz 3 - Stok, Alım ve Lojistik

1. `inventory_units` ve `inventory_items` çekirdeği
2. Stok belge modeli + reversal
3. Negatif stok engeli
4. Alım faturası (draft/approved/cancelled)
5. Alım import (satır + seri listesi)
6. Transfer (draft/shipped/received, kısmi teslim)
7. Uyuşmazlık çözüm akışı
8. Sayım (depo kilitli)
9. Sayım farkı + adjustment
10. Stok görünürlük ekranları + seri timeline

### 16.4) Faz 4 - Cari, Kasa ve Ön Muhasebe

1. Tek cari kartı (tip bazlı)
2. Ledger, bakiye, vade, limit, risk
3. Kasa/banka/POS hesapları
4. Tahsilat/ödeme ve payment allocation (FIFO)
5. Standalone vs External muhasebe modu
6. Entegrasyon connector altyapısı
7. Match & Merge çakışma ekranı

### 16.5) Faz 5 - Satış ve Fiyatlandırma

1. 7 seviye fiyat/prim override altyapısı
2. Effective cache ve recalculation job
3. Min fiyat altı satış kontrolü
4. Satış ekranı (kategori->ürün->seri->cari->ödeme)
5. Satış onayında atomik stok düşümü
6. Gün sonu kasa kapatma
7. Satış iptal/iade akışı

### 16.6) Faz 6 - KPI, Prim ve Raporlama

1. KPI tanım ve hedef yönetimi
2. Gerçekleşme takibi (bölge->şube->personel)
3. Parametrik prim kural motoru
4. Kampanya bazlı prim
5. Prim hesap, tahakkuk ve kesinti akışları
6. Data visibility layer destekli raporlar
7. Ceza düğmesi/prim kesinti yönetimi
8. Dashboard realtime KPI göstergeleri
9. Excel/PDF export ve API dokümantasyonu (Swagger/OpenAPI)
10. Mobil uygulama hedefi (PWA veya React Native)

## 17) Stratejik Riskler ve Mitigasyon

1. Prim yanlış hesaplama riski: prim motoru en son fazda devreye alınır.
2. Seri duplicate/race condition: DB unique + onay anında transaction içi re-check.
3. Scope bypass/veri sızıntısı: RLS + middleware çift kontrol + düzenli güvenlik testleri.
4. Büyük tenant performans riski: composite index, pagination, cache ve async job kullanımı.
5. Entegrasyon uyumsuzluğu: adapter pattern ve connector versiyonlama.

## 18) Geliştirme Prensipleri (Uygulama Disiplini)

1. Parametrik önce: kural setleri kod içine gömülmez.
2. Atomik işlem: stok + cari + belge etkisi tek transaction.
3. Soft delete varsayılan.
4. Mobil öncelikli operasyon ekranları (satış, transfer, sayım).
5. Drawer-first ve wizard-first UI.
6. Boş durum + CTA standardı.
7. Kritik modüllerde test kapsamı zorunlu: seri takip, transfer, sayım, fiyat/prim hesapları.

## 20) MVP ve Ürünleme Stratejisi

1. MVP kapsamı: Faz 1-3 çekirdeği ile canlıya çıkış yapılabilir.
2. İlk ürünleme dili: stok + seri takip + operasyonel kontrol.
3. Prim motoru, yanlış hesap riskini azaltmak için premium ve geç fazda açılır.
4. Paketleme önerisi:
   - Basic: Org + HR + temel takip
   - Pro: Stok + ön muhasebe + entegrasyon
   - Enterprise: Prim motoru + gelişmiş raporlama + API

## 19) Ekran Bazlı UI Tasarım Rehberi (V1)

### 19.1) Genel UI Kuralları

1. Tüm ana modüllerde üst satır yapısı sabit olmalı: başlık + hızlı arama + filtre + birincil aksiyon.
2. Birincil aksiyon butonu sayfada tek ve net olmalı (`Ekle`, `Oluştur`, `Onayla`).
3. Detay görüntüleme sayfa geçişi yerine öncelikli olarak right drawer ile yapılmalı.
4. Uzun işlem akışları wizard (adım adım) ile çözülmeli.
5. Kritik durumlar renk kodlu rozetlerle standart gösterilmeli: `draft`, `approved`, `cancelled`, `in_transit`, `partial`, `blocked`.

### 19.2) Dashboard (Genel Bakış)

1. Üst bant: firma adı, paket, abonelik bitiş tarihi, kalan gün.
2. KPI kartları: aktif mağaza/limit, aktif kullanıcı/limit, kurulum yüzdesi, bu ay satış özeti.
3. Operasyon kartları: bekleyen transfer, sayım uyarısı, limit dolumu, read-only bilgisi.
4. Hızlı aksiyonlar: personel ekle, satış başlat, transfer oluştur, alım faturası oluştur.

### 19.3) Ürün ve Katalog Ekranları

1. Ürün listesi: arama + kategori/marka/tracking filtreleri + `Ürün Ekle`, `İçe Aktar`, `Dışa Aktar`.
2. Ürün ekleme: 2 adımlı wizard (`Genel` -> `Takip ve Fiyat`).
3. Ürün detay drawer: temel bilgiler, şube stok özeti, son hareketler.
4. Kategori ve marka yönetimi: sade liste + inline ekleme modalı; kullanımda olan kayıtlarda güvenli pasifleştirme.

### 19.4) Transfer Ekranları

1. Transfer listesi: durum, kaynak->hedef, satır sayısı, teslim oranı.
2. Transfer oluşturma wizard: başlık -> satırlar -> onay.
3. Seri ürünlerde teslim ve sevk akışı barkod okutma odaklı olmalı.
4. Kısmi teslim görünürlüğü zorunlu: `Gönderilen / Teslim Alınan / Yolda / Eksik`.
5. Şube dashboard’da `Bekleyen Transferler` kartından tek tık teslim alma akışı bulunmalı.

### 19.5) Sayım Ekranları

1. Sayım başlat ekranı: depo, sayım tipi (tam/kısmi), kapsam ve tarih.
2. Sayım sırasında depo kilitli uyarısı sürekli görünür olmalı.
3. Sayım giriş ekranı barkod/seri okutma odaklı ve büyük input alanlı olmalı.
4. Kontrol ekranında sistem-sayım fark tablosu + parasal etki kartı gösterilmeli.
5. Uygulama seçenekleri: `Sadece Raporla` ve `Stoku Uygula`.

### 19.6) Cari, Kasa ve Ödeme Ekranları

1. Cari listesi kolon standardı: cari adı, tip, bakiye, geciken tutar, limit, risk.
2. Cari detayda sekmeler: özet, ekstre, açık kalemler, tahsilat/ödemeler.
3. Tahsilat/ödeme ekranı tek form olmalı: yön, cari, tutar, hesap, yöntem, not.
4. Kasa/banka ekranı kart bazlı olmalı: bakiye, günlük giriş/çıkış, son hareketler.

### 19.7) Satış Ekranı (V1 Hazırlık Standardı)

1. Satış akışı tek ekranda adımlı olmalı: kategori -> ürün -> seri -> cari -> ödeme.
2. Serili ürünlerde IMEI/ICCID seçilmeden ilerlenemez.
3. `in_transit`, `sold`, `reserved` statüsündeki seri satış seçimine kapalı olmalı.
4. Min fiyat ve cari limit kontrolü kullanıcıya açık ve aksiyon odaklı mesajla gösterilmeli.

### 19.8) Fiyat ve Prim Yönetim Ekranı

1. Tek merkez ekran: satış fiyatı, min fiyat, prim, puan alanlarını birlikte yönetir.
2. Firma/şube modu toggle ile aynı ekranda override yönetimi yapılır.
3. Kaynak kolonu zorunludur: hangi seviye kuralın uygulandığını gösterir.
4. Toplu güncelleme için Excel import wizard (ön izleme + hata raporu + onay) zorunludur.

### 19.9) Boş Durum, Hata ve Onay Tasarım Standardı

1. Boş durum ekranları her modülde yönlendirici CTA içermeli.
2. Hata mesajı formatı sabit olmalı: problem + neden + çözüm aksiyonu.
3. Kritik işlemlerde iki adımlı onay kullanılmalı: kullanıcı teyidi + işlem özeti.
4. Uzun işlemlerde ilerleme durumu ve işlem sonucu raporu gösterilmeli.
