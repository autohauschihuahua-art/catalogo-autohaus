-- ========================================================
-- AUTOHAUS ENTERPRISE RELATIONAL SCHEMA (SUPABASE POSTGRESQL)
-- ========================================================

-- DROP EXISTING TABLES TO ENSURE CLEAN FOREIGN KEY RELATIONSHIPS
DROP TABLE IF EXISTS public.client_favorites CASCADE;
DROP TABLE IF EXISTS public.user_favorites CASCADE;
DROP TABLE IF EXISTS public.vehicle_status_history CASCADE;
DROP TABLE IF EXISTS public.leads CASCADE;
DROP TABLE IF EXISTS public.vehicles CASCADE;
DROP TABLE IF EXISTS public.clients CASCADE;
DROP TABLE IF EXISTS public.sales_reps CASCADE;
DROP TABLE IF EXISTS public.branches CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- 1. SUCURSALES (branches)
CREATE TABLE public.branches (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT DEFAULT '',
  city TEXT DEFAULT 'Chihuahua',
  phone TEXT DEFAULT ''
);

-- 2. USUARIOS & AUTENTICACIÓN (users)
CREATE TABLE public.users (
  id BIGINT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT DEFAULT '',
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'client',
  favorites JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. VENDEDORES (sales_reps)
CREATE TABLE public.sales_reps (
  id SERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
  branch_id INTEGER REFERENCES public.branches(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT true,
  turn_order INTEGER DEFAULT 1
);

-- 4. CLIENTES (clients)
CREATE TABLE public.clients (
  id BIGINT PRIMARY KEY,
  user_id BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT DEFAULT '',
  city TEXT DEFAULT 'Chihuahua',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. VEHÍCULOS / INVENTARIO (vehicles)
CREATE TABLE public.vehicles (
  id TEXT PRIMARY KEY,
  branch_id INTEGER REFERENCES public.branches(id) ON DELETE SET NULL,
  page INTEGER,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  category TEXT NOT NULL DEFAULT 'SEDAN & HATCHBACK',
  price_contado TEXT NOT NULL DEFAULT 'zsh',
  price_financiado TEXT DEFAULT 'No Aplica',
  price_num BIGINT DEFAULT 0,
  status TEXT DEFAULT 'disponible',
  specs JSONB DEFAULT '[]'::jsonb,
  cover_photo TEXT DEFAULT 'assets/svg/autohaus-tag.svg',
  real_photos JSONB DEFAULT '[]'::jsonb,
  cutout_photo TEXT DEFAULT 'assets/svg/autohaus-tag.svg',
  main_photo TEXT DEFAULT 'assets/svg/autohaus-tag.svg',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. HISTORIAL DE ESTATUS Y MOVIMIENTOS (vehicle_status_history)
CREATE TABLE public.vehicle_status_history (
  id TEXT PRIMARY KEY,
  vehicle_id TEXT REFERENCES public.vehicles(id) ON DELETE CASCADE,
  client_id BIGINT REFERENCES public.clients(id) ON DELETE SET NULL,
  sales_rep_id INTEGER REFERENCES public.sales_reps(id) ON DELETE SET NULL,
  status TEXT NOT NULL,
  previous_status TEXT DEFAULT '',
  deposit_amount TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. LEADS / PROSPECTOS (leads)
CREATE TABLE public.leads (
  id TEXT PRIMARY KEY,
  client_id BIGINT REFERENCES public.clients(id) ON DELETE SET NULL,
  vehicle_id TEXT REFERENCES public.vehicles(id) ON DELETE SET NULL,
  sales_rep_id INTEGER REFERENCES public.sales_reps(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  client_email TEXT DEFAULT '',
  vehicle_page INTEGER,
  vehicle_name TEXT DEFAULT '',
  assigned_to TEXT DEFAULT '',
  assigned_name TEXT DEFAULT '',
  status TEXT DEFAULT 'nuevo',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. FAVORITOS DE CLIENTES (client_favorites)
CREATE TABLE public.client_favorites (
  client_id BIGINT REFERENCES public.clients(id) ON DELETE CASCADE,
  vehicle_id TEXT REFERENCES public.vehicles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (client_id, vehicle_id)
);

-- RLS POLICIES
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_reps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read branches" ON public.branches FOR SELECT USING (true);
CREATE POLICY "Service full branches" ON public.branches FOR ALL USING (true);
CREATE POLICY "Public read users" ON public.users FOR SELECT USING (true);
CREATE POLICY "Service full users" ON public.users FOR ALL USING (true);
CREATE POLICY "Public read sales_reps" ON public.sales_reps FOR SELECT USING (true);
CREATE POLICY "Service full sales_reps" ON public.sales_reps FOR ALL USING (true);
CREATE POLICY "Public read clients" ON public.clients FOR SELECT USING (true);
CREATE POLICY "Service full clients" ON public.clients FOR ALL USING (true);
CREATE POLICY "Public read vehicles" ON public.vehicles FOR SELECT USING (true);
CREATE POLICY "Service full vehicles" ON public.vehicles FOR ALL USING (true);
CREATE POLICY "Public read status_history" ON public.vehicle_status_history FOR SELECT USING (true);
CREATE POLICY "Service full status_history" ON public.vehicle_status_history FOR ALL USING (true);
CREATE POLICY "Public read leads" ON public.leads FOR SELECT USING (true);
CREATE POLICY "Service full leads" ON public.leads FOR ALL USING (true);
CREATE POLICY "Public read client_favorites" ON public.client_favorites FOR SELECT USING (true);
CREATE POLICY "Service full client_favorites" ON public.client_favorites FOR ALL USING (true);

-- SEED SUCURSALES
INSERT INTO public.branches (id, name, address, city, phone)
VALUES 
  (1, 'Sucursal San Felipe', 'Av. San Felipe #123', 'Chihuahua, Chih.', '614 365 3015'),
  (2, 'Sucursal Central de Abastos', 'Av. Central de Abastos #456', 'Chihuahua, Chih.', '614 365 3015');

-- SEED USERS
INSERT INTO public.users (id, name, email, phone, password, role, favorites)
VALUES 
  (1, 'Administrador Autohaus', 'admin@autohaus.mx', '', 'aIXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', '[]'::jsonb),
  (2, 'Alice (Secretaria)', 'alice@autohaus.mx', '', 'aIXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'secretary', '[]'::jsonb),
  (3, 'Napo (Vendedor)', 'napo@autohaus.mx', '614 111 2233', 'aIXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'sales', '[]'::jsonb),
  (4, 'Javier (Vendedor)', 'javier@autohaus.mx', '614 222 3344', 'aIXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'sales', '[]'::jsonb),
  (5, 'Fernanda (Vendedora)', 'fernanda@autohaus.mx', '614 333 4455', 'aIXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'sales', '[]'::jsonb),
  (6, 'Raúl (Vendedor)', 'raul@autohaus.mx', '614 444 5566', 'aIXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'sales', '[]'::jsonb),
  (1788220562093, 'Carlos Mendoza', 'cliente_test_1788220562010@ejemplo.com', '614 123 4567', 'aIXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'client', '[]'::jsonb);

-- SEED VENDEDORES (sales_reps)
INSERT INTO public.sales_reps (id, user_id, branch_id, name, email, phone, is_active, turn_order)
VALUES
  (1, 3, 1, 'Napo', 'napo@autohaus.mx', '614 111 2233', true, 1),
  (2, 4, 1, 'Javier', 'javier@autohaus.mx', '614 222 3344', true, 2),
  (3, 5, 2, 'Fernanda', 'fernanda@autohaus.mx', '614 333 4455', true, 3),
  (4, 6, 2, 'Raúl', 'raul@autohaus.mx', '614 444 5566', true, 4);

-- SEED CLIENTES (clients)
INSERT INTO public.clients (id, user_id, name, email, phone, city)
VALUES
  (1, 1788220562093, 'Carlos Mendoza', 'cliente_test_1788220562010@ejemplo.com', '614 123 4567', 'Chihuahua'),
  (2, NULL, 'Roberto Domínguez', 'roberto@ejemplo.com', '614 199 8877', 'Chihuahua'),
  (3, NULL, 'Alejandro Morales', 'alejandro@ejemplo.com', '614 777 1234', 'Chihuahua'),
  (4, NULL, 'Roberto Alvídrez', 'alvidrez@ejemplo.com', '614 555 8899', 'Chihuahua'),
  (5, NULL, 'David Ochoa', 'david@ejemplo.com', '614 333 2211', 'Chihuahua'),
  (6, NULL, 'Mariana Garza', 'mariana@ejemplo.com', '614 987 6543', 'Chihuahua');

-- SEED VEHICLES (56 VEHICLES)
INSERT INTO public.vehicles (id, branch_id, page, brand, model, year, category, price_contado, price_financiado, price_num, status, specs, cover_photo, real_photos, cutout_photo, main_photo)
VALUES ('autohaus-p7', 1, 7, 'Nissan', 'Sentra Sense', 2018, 'SEDAN & HATCHBACK', '$185,000', '$195,000', 185000, 'disponible', '["Automático","Eléctrico","Asientos en tela","76,000 km","Factura de seminuevos autotokio"]'::jsonb, 'assets/cars/page_7_img_2.jpeg', '["assets/cars/page_7_img_2.jpeg","assets/cars/page_7_img_3.jpeg","assets/cars/page_7_img_4.jpeg","assets/cars/page_7_img_5.jpeg"]'::jsonb, 'assets/cars/page_7_img_2.jpeg', 'assets/cars/page_7_img_2.jpeg');
INSERT INTO public.vehicles (id, branch_id, page, brand, model, year, category, price_contado, price_financiado, price_num, status, specs, cover_photo, real_photos, cutout_photo, main_photo)
VALUES ('autohaus-p8', 2, 8, 'Chevrolet', 'Beat LT Hatchback', 2021, 'SEDAN & HATCHBACK', '$175,000', '$185,000', 175000, 'disponible', '["Transmisión manual","Vidrios delanteros eléctricos","Vidrios traseros manuales","Asientos en tela","125,000 km","Factura de agencia","1 dueño","2 llaves"]'::jsonb, 'assets/cars/page_8_img_2.jpeg', '["assets/cars/page_8_img_2.jpeg","assets/cars/page_8_img_3.jpeg","assets/cars/page_8_img_4.jpeg","assets/cars/page_8_img_5.jpeg"]'::jsonb, 'assets/cars/page_8_img_2.jpeg', 'assets/cars/page_8_img_2.jpeg');
INSERT INTO public.vehicles (id, branch_id, page, brand, model, year, category, price_contado, price_financiado, price_num, status, specs, cover_photo, real_photos, cutout_photo, main_photo)
VALUES ('autohaus-p9', 1, 9, 'Mazda', 'Mazda 3 Grand Touring', 2023, 'SEDAN & HATCHBACK', '$360,000', '$370,000', 360000, 'disponible', '["Factura de agencia","Único dueño","73,000 km"]'::jsonb, 'assets/cars/page_9_img_2.jpeg', '["assets/cars/page_9_img_2.jpeg","assets/cars/page_9_img_3.jpeg","assets/cars/page_9_img_4.jpeg","assets/cars/page_9_img_5.jpeg"]'::jsonb, 'assets/cars/page_9_img_2.jpeg', 'assets/cars/page_9_img_2.jpeg');
INSERT INTO public.vehicles (id, branch_id, page, brand, model, year, category, price_contado, price_financiado, price_num, status, specs, cover_photo, real_photos, cutout_photo, main_photo)
VALUES ('autohaus-p10', 2, 10, 'Nissan', 'Sentra Advance', 2017, 'SEDAN & HATCHBACK', '$185,000', '$195,000', 185000, 'disponible', '["Automático","Eléctrico","Asientos en tela","Pantalla touch con Apple CarPlay y Android Auto","Cámara de reversa","Factura de agencia","2 llaves","124,000 km"]'::jsonb, 'assets/cars/page_10_img_2.jpeg', '["assets/cars/page_10_img_2.jpeg","assets/cars/page_10_img_3.jpeg","assets/cars/page_10_img_4.jpeg","assets/cars/page_10_img_5.jpeg"]'::jsonb, 'assets/cars/page_10_img_2.jpeg', 'assets/cars/page_10_img_2.jpeg');
INSERT INTO public.vehicles (id, branch_id, page, brand, model, year, category, price_contado, price_financiado, price_num, status, specs, cover_photo, real_photos, cutout_photo, main_photo)
VALUES ('autohaus-p12', 1, 12, 'Mercedes-Benz', 'C280', 2008, 'SEDAN & HATCHBACK', '$115,000', '$115,000', 115000, 'disponible', '["Factura de seminuevos","100% mexicano","Asientos en piel","Automático","Eléctrico","Quemacocos","Motor V6","1 llave 🔑"]'::jsonb, 'assets/cars/page_12_img_2.jpeg', '["assets/cars/page_12_img_2.jpeg","assets/cars/page_12_img_3.jpeg","assets/cars/page_12_img_4.jpeg","assets/cars/page_12_img_5.jpeg"]'::jsonb, 'assets/cars/page_12_img_2.jpeg', 'assets/cars/page_12_img_2.jpeg');
INSERT INTO public.vehicles (id, branch_id, page, brand, model, year, category, price_contado, price_financiado, price_num, status, specs, cover_photo, real_photos, cutout_photo, main_photo)
VALUES ('autohaus-p13', 2, 13, 'Audi', 'A3 Select', 2018, 'SEDAN & HATCHBACK', '$275,000', '$285,000', 275000, 'disponible', '["Automático","Eléctrico","Asientos en tela/piel","1 llave","165,000 km","Encendido de botón"]'::jsonb, 'assets/cars/page_13_img_2.jpeg', '["assets/cars/page_13_img_2.jpeg","assets/cars/page_13_img_3.jpeg","assets/cars/page_13_img_4.jpeg","assets/cars/page_13_img_5.jpeg"]'::jsonb, 'assets/cars/page_13_img_2.jpeg', 'assets/cars/page_13_img_2.jpeg');
INSERT INTO public.vehicles (id, branch_id, page, brand, model, year, category, price_contado, price_financiado, price_num, status, specs, cover_photo, real_photos, cutout_photo, main_photo)
VALUES ('autohaus-p14', 1, 14, 'Kia', 'Rio EX Pack', 2023, 'SEDAN & HATCHBACK', '$290,000', '$300,000', 290000, 'disponible', '["Automático","Eléctrico","70,000 km","Factura de agencia","Único dueño","1 llave","Asientos en piel","Cámara de reversa"]'::jsonb, 'assets/cars/page_14_img_2.jpeg', '["assets/cars/page_14_img_2.jpeg","assets/cars/page_14_img_3.jpeg","assets/cars/page_14_img_4.jpeg","assets/cars/page_14_img_5.jpeg"]'::jsonb, 'assets/cars/page_14_img_2.jpeg', 'assets/cars/page_14_img_2.jpeg');
INSERT INTO public.vehicles (id, branch_id, page, brand, model, year, category, price_contado, price_financiado, price_num, status, specs, cover_photo, real_photos, cutout_photo, main_photo)
VALUES ('autohaus-p15', 2, 15, 'Toyota', 'Prius C Hatchback', 2021, 'SEDAN & HATCHBACK', '$255,000', '$265,000', 255000, 'disponible', '["Híbrido","Automático","Eléctrico","Asientos en tela","70,000 km","Factura de empresa","1 llave 🔑"]'::jsonb, 'assets/cars/page_15_img_2.jpeg', '["assets/cars/page_15_img_2.jpeg","assets/cars/page_15_img_3.jpeg","assets/cars/page_15_img_4.jpeg","assets/cars/page_15_img_5.jpeg"]'::jsonb, 'assets/cars/page_15_img_2.jpeg', 'assets/cars/page_15_img_2.jpeg');
INSERT INTO public.vehicles (id, branch_id, page, brand, model, year, category, price_contado, price_financiado, price_num, status, specs, cover_photo, real_photos, cutout_photo, main_photo)
VALUES ('autohaus-p16', 1, 16, 'Chevrolet', 'Beat LT', 2019, 'SEDAN & HATCHBACK', '$160,000', '$170,000', 160000, 'disponible', '["Transmisión manual","Semi eléctrico","80,000 km","Factura de agencia","1 dueño","Asientos en tela","2 llaves","Motor 4 cil. 1.2 litros"]'::jsonb, 'assets/cars/page_16_img_2.jpeg', '["assets/cars/page_16_img_2.jpeg","assets/cars/page_16_img_3.jpeg","assets/cars/page_16_img_4.jpeg","assets/cars/page_16_img_5.jpeg"]'::jsonb, 'assets/cars/page_16_img_2.jpeg', 'assets/cars/page_16_img_2.jpeg');
INSERT INTO public.vehicles (id, branch_id, page, brand, model, year, category, price_contado, price_financiado, price_num, status, specs, cover_photo, real_photos, cutout_photo, main_photo)
VALUES ('autohaus-p17', 2, 17, 'Volkswagen', 'Jetta Comfortline', 2025, 'SEDAN & HATCHBACK', '$399,000', '$409,000', 399000, 'disponible', '["Automático","Eléctrico","Asientos en tela","Cámara de reversa","14,000 km","Factura de agencia","Único dueño","2 llaves 🔑"]'::jsonb, 'assets/cars/page_17_img_2.jpeg', '["assets/cars/page_17_img_2.jpeg","assets/cars/page_17_img_3.jpeg","assets/cars/page_17_img_4.jpeg","assets/cars/page_17_img_5.jpeg"]'::jsonb, 'assets/cars/page_17_img_2.jpeg', 'assets/cars/page_17_img_2.jpeg');
INSERT INTO public.vehicles (id, branch_id, page, brand, model, year, category, price_contado, price_financiado, price_num, status, specs, cover_photo, real_photos, cutout_photo, main_photo)
VALUES ('autohaus-p19', 1, 19, 'Mercedes-Benz', 'S500 Wald Black', 2015, 'SEDAN & HATCHBACK', '$1,100,000', '$1,100,000', 1100000, 'disponible', '["Full catback","Intakes","Repro","Bodykit WALD","61,000 km","Techo panorámico","Mexicano 100%","Motor V8 biturbo 4.7L","Se toma una o dos unidades a cuenta"]'::jsonb, 'assets/cars/page_19_img_2.jpeg', '["assets/cars/page_19_img_2.jpeg","assets/cars/page_19_img_3.jpeg","assets/cars/page_19_img_4.jpeg","assets/cars/page_19_img_5.jpeg"]'::jsonb, 'assets/cars/page_19_img_2.jpeg', 'assets/cars/page_19_img_2.jpeg');
INSERT INTO public.vehicles (id, branch_id, page, brand, model, year, category, price_contado, price_financiado, price_num, status, specs, cover_photo, real_photos, cutout_photo, main_photo)
VALUES ('autohaus-p20', 2, 20, 'Nissan', 'Sentra Advance', 2020, 'SEDAN & HATCHBACK', '$260,000', '$270,000', 260000, 'disponible', '["Automático","Eléctrico","Asientos en tela","Cámara de reversa","Factura de agencia"]'::jsonb, 'assets/cars/page_20_img_2.jpeg', '["assets/cars/page_20_img_2.jpeg","assets/cars/page_20_img_3.jpeg","assets/cars/page_20_img_4.jpeg","assets/cars/page_20_img_5.jpeg"]'::jsonb, 'assets/cars/page_20_img_2.jpeg', 'assets/cars/page_20_img_2.jpeg');
INSERT INTO public.vehicles (id, branch_id, page, brand, model, year, category, price_contado, price_financiado, price_num, status, specs, cover_photo, real_photos, cutout_photo, main_photo)
VALUES ('autohaus-p21', 1, 21, 'Honda', 'City Prime', 2024, 'SEDAN & HATCHBACK', '$330,000', '$340,000', 330000, 'disponible', '["Automático","Eléctrico","Asientos en tela","Pantalla touch","Cámara de reversa","Cámara lateral","Factura de agencia","18,000 km"]'::jsonb, 'assets/cars/page_21_img_2.jpeg', '["assets/cars/page_21_img_2.jpeg","assets/cars/page_21_img_3.jpeg","assets/cars/page_21_img_4.jpeg","assets/cars/page_21_img_5.jpeg"]'::jsonb, 'assets/cars/page_21_img_2.jpeg', 'assets/cars/page_21_img_2.jpeg');
INSERT INTO public.vehicles (id, branch_id, page, brand, model, year, category, price_contado, price_financiado, price_num, status, specs, cover_photo, real_photos, cutout_photo, main_photo)
VALUES ('autohaus-p22', 2, 22, 'Ford', 'Figo Energy', 2018, 'SEDAN & HATCHBACK', '$130,000', '$140,000', 130000, 'disponible', '["Automático","Vidrios manuales","Asientos en tela","126,000 km"]'::jsonb, 'assets/cars/page_22_img_2.jpeg', '["assets/cars/page_22_img_2.jpeg","assets/cars/page_22_img_3.jpeg","assets/cars/page_22_img_4.jpeg","assets/cars/page_22_img_5.jpeg"]'::jsonb, 'assets/cars/page_22_img_2.jpeg', 'assets/cars/page_22_img_2.jpeg');
INSERT INTO public.vehicles (id, branch_id, page, brand, model, year, category, price_contado, price_financiado, price_num, status, specs, cover_photo, real_photos, cutout_photo, main_photo)
VALUES ('autohaus-p23', 1, 23, 'Nissan', 'Sentra Sense', 2022, 'SEDAN & HATCHBACK', '$269,000', '$279,000', 269000, 'disponible', '["Factura de agencia","Único dueño","Transmisión manual","Eléctrico","Asientos en tela","82,000 km","2 llaves 🔑"]'::jsonb, 'assets/cars/page_23_img_2.jpeg', '["assets/cars/page_23_img_2.jpeg","assets/cars/page_23_img_3.jpeg","assets/cars/page_23_img_4.jpeg","assets/cars/page_23_img_5.jpeg"]'::jsonb, 'assets/cars/page_23_img_2.jpeg', 'assets/cars/page_23_img_2.jpeg');
INSERT INTO public.vehicles (id, branch_id, page, brand, model, year, category, price_contado, price_financiado, price_num, status, specs, cover_photo, real_photos, cutout_photo, main_photo)
VALUES ('autohaus-p25', 2, 25, 'Mercedes-Benz', 'GLE 450', 2020, 'SUV''S', '$620,000', '$630,000', 620000, 'disponible', '["SUV","Automática","Eléctrica","Asientos en piel","Cámara de reversa","3 filas de pasajeros","152,000 km","Factura de agencia"]'::jsonb, 'assets/cars/page_25_img_2.jpeg', '["assets/cars/page_25_img_2.jpeg","assets/cars/page_25_img_3.jpeg","assets/cars/page_25_img_4.jpeg","assets/cars/page_25_img_5.jpeg"]'::jsonb, 'assets/cars/page_25_img_2.jpeg', 'assets/cars/page_25_img_2.jpeg');
INSERT INTO public.vehicles (id, branch_id, page, brand, model, year, category, price_contado, price_financiado, price_num, status, specs, cover_photo, real_photos, cutout_photo, main_photo)
VALUES ('autohaus-p26', 1, 26, 'Hyundai', 'Creta Grand Limited', 2022, 'SUV''S', '$395,000', '$405,000', 395000, 'disponible', '["Automática","Eléctrica","Asientos en piel bi-tono","46,000 km","Factura de seminuevos de agencia Hyundai","3 filas de asientos (7 pasajeros)","Motor 4 cil 2.0L","2 llaves 🔑"]'::jsonb, 'assets/cars/page_26_img_2.jpeg', '["assets/cars/page_26_img_2.jpeg","assets/cars/page_26_img_3.jpeg","assets/cars/page_26_img_4.jpeg","assets/cars/page_26_img_5.jpeg"]'::jsonb, 'assets/cars/page_26_img_2.jpeg', 'assets/cars/page_26_img_2.jpeg');
INSERT INTO public.vehicles (id, branch_id, page, brand, model, year, category, price_contado, price_financiado, price_num, status, specs, cover_photo, real_photos, cutout_photo, main_photo)
VALUES ('autohaus-p27', 2, 27, 'Mazda', 'CX-9 Grand Touring', 2020, 'SUV''S', '$455,000', '$465,000', 455000, 'disponible', '["Automática","Eléctrica","Asientos en piel","3 filas de asientos","Cámara de reversa","Quemacocos","Factura de seminuevos","2 llaves 🔑"]'::jsonb, 'assets/cars/page_27_img_2.jpeg', '["assets/cars/page_27_img_2.jpeg","assets/cars/page_27_img_3.jpeg","assets/cars/page_27_img_4.jpeg","assets/cars/page_27_img_5.jpeg"]'::jsonb, 'assets/cars/page_27_img_2.jpeg', 'assets/cars/page_27_img_2.jpeg');
INSERT INTO public.vehicles (id, branch_id, page, brand, model, year, category, price_contado, price_financiado, price_num, status, specs, cover_photo, real_photos, cutout_photo, main_photo)
VALUES ('autohaus-p28', 1, 28, 'Hyundai', 'Tucson Limited Tech Hybrid', 2025, 'SUV''S', '$740,000', '$750,000', 740000, 'disponible', '["Automática","Eléctrica","Asientos en piel","Quemacocos","Techo panorámico","Cámara de reversa","Cámara frontal","7,000 km","Factura de agencia","1 dueño"]'::jsonb, 'assets/cars/page_28_img_2.jpeg', '["assets/cars/page_28_img_2.jpeg","assets/cars/page_28_img_3.jpeg","assets/cars/page_28_img_4.jpeg","assets/cars/page_28_img_5.jpeg"]'::jsonb, 'assets/cars/page_28_img_2.jpeg', 'assets/cars/page_28_img_2.jpeg');
INSERT INTO public.vehicles (id, branch_id, page, brand, model, year, category, price_contado, price_financiado, price_num, status, specs, cover_photo, real_photos, cutout_photo, main_photo)
VALUES ('autohaus-p29', 2, 29, 'Volkswagen', 'Teramont Cross Sport R-Line', 2024, 'SUV''S', '$945,000', '$955,000', 945000, 'disponible', '["Automática","Eléctrica","Asientos en piel bi-tono","Quemacocos","Cámara de reversa","Factura de agencia","Única dueña","2 llaves 🔑","Servicios en la agencia","15,000 km"]'::jsonb, 'assets/cars/page_29_img_2.jpeg', '["assets/cars/page_29_img_2.jpeg","assets/cars/page_29_img_3.jpeg","assets/cars/page_29_img_4.jpeg","assets/cars/page_29_img_5.jpeg"]'::jsonb, 'assets/cars/page_29_img_2.jpeg', 'assets/cars/page_29_img_2.jpeg');
INSERT INTO public.vehicles (id, branch_id, page, brand, model, year, category, price_contado, price_financiado, price_num, status, specs, cover_photo, real_photos, cutout_photo, main_photo)
VALUES ('autohaus-p30', 1, 30, 'Hyundai', 'Tucson GLS', 2024, 'SUV''S', '$485,000', '$495,000', 485000, 'disponible', '["Automática","Eléctrica","Asientos en tela","Cámara de reversa","40,000 km","Factura de agencia","1 dueño","2 llaves 🔑"]'::jsonb, 'assets/cars/page_30_img_2.jpeg', '["assets/cars/page_30_img_2.jpeg","assets/cars/page_30_img_3.jpeg","assets/cars/page_30_img_4.jpeg","assets/cars/page_30_img_5.jpeg"]'::jsonb, 'assets/cars/page_30_img_2.jpeg', 'assets/cars/page_30_img_2.jpeg');
INSERT INTO public.vehicles (id, branch_id, page, brand, model, year, category, price_contado, price_financiado, price_num, status, specs, cover_photo, real_photos, cutout_photo, main_photo)
VALUES ('autohaus-p31', 2, 31, 'Porsche', 'Cayenne Coupe Turbo GT', 2024, 'SUV''S', '$3,200,000', '$3,210,000', 3200000, 'disponible', '["Automática","Eléctrica","Asientos en tela/alcántara","Cámara de reversa / frontal","A/C doble zona","Factura de empresa","16,000 km","Motor V8 4.0L Turbo 659 hp"]'::jsonb, 'assets/cars/page_31_img_2.jpeg', '["assets/cars/page_31_img_2.jpeg","assets/cars/page_31_img_3.jpeg","assets/cars/page_31_img_4.jpeg","assets/cars/page_31_img_5.jpeg"]'::jsonb, 'assets/cars/page_31_img_2.jpeg', 'assets/cars/page_31_img_2.jpeg');
INSERT INTO public.vehicles (id, branch_id, page, brand, model, year, category, price_contado, price_financiado, price_num, status, specs, cover_photo, real_photos, cutout_photo, main_photo)
VALUES ('autohaus-p32', 1, 32, 'Mercedes-Benz', 'GLE 43 AMG Coupe', 2019, 'SUV''S', '$750,000', '$760,000', 750000, 'disponible', '["Automática","Eléctrica","Asientos en piel","Factura de agencia","100,000 km","Motor V6 biturbo","Tracción 4MATIC","Cámara de reversa","Quemacocos","Rines Vossen","Iluminación LED en puertas"]'::jsonb, 'assets/cars/page_32_img_2.jpeg', '["assets/cars/page_32_img_2.jpeg","assets/cars/page_32_img_3.jpeg","assets/cars/page_32_img_4.jpeg","assets/cars/page_32_img_5.jpeg"]'::jsonb, 'assets/cars/page_32_img_2.jpeg', 'assets/cars/page_32_img_2.jpeg');
INSERT INTO public.vehicles (id, branch_id, page, brand, model, year, category, price_contado, price_financiado, price_num, status, specs, cover_photo, real_photos, cutout_photo, main_photo)
VALUES ('autohaus-p33', 2, 33, 'Audi', 'Q3 Elite', 2018, 'SUV''S', '$330,000', '$340,000', 330000, 'disponible', '["Automática","Eléctrica","Asientos en piel","Factura de agencia","103,000 km","Motor 4 cil. 2.0L","Quemacocos","2 llaves","Único dueño"]'::jsonb, 'assets/cars/page_33_img_2.jpeg', '["assets/cars/page_33_img_2.jpeg","assets/cars/page_33_img_3.jpeg","assets/cars/page_33_img_4.jpeg","assets/cars/page_33_img_5.jpeg"]'::jsonb, 'assets/cars/page_33_img_2.jpeg', 'assets/cars/page_33_img_2.jpeg');
INSERT INTO public.vehicles (id, branch_id, page, brand, model, year, category, price_contado, price_financiado, price_num, status, specs, cover_photo, real_photos, cutout_photo, main_photo)
VALUES ('autohaus-p34', 1, 34, 'Audi', 'Q5 Elite', 2020, 'SUV''S', '$495,000', '$505,000', 495000, 'disponible', '["Asientos en piel","Cámara de reversa","Quemacocos","Cluster digital","Factura de agencia","Única dueña","56,000 km","Motor 2.0 Turbo","Tracción Quattro"]'::jsonb, 'assets/cars/page_34_img_2.jpeg', '["assets/cars/page_34_img_2.jpeg","assets/cars/page_34_img_3.jpeg","assets/cars/page_34_img_4.jpeg","assets/cars/page_34_img_5.jpeg"]'::jsonb, 'assets/cars/page_34_img_2.jpeg', 'assets/cars/page_34_img_2.jpeg');
INSERT INTO public.vehicles (id, branch_id, page, brand, model, year, category, price_contado, price_financiado, price_num, status, specs, cover_photo, real_photos, cutout_photo, main_photo)
VALUES ('autohaus-p35', 2, 35, 'Mazda', 'CX-9 Grand Touring', 2020, 'SUV''S', '$455,000', '$465,000', 455000, 'disponible', '["Automática","Eléctrica","Asientos en tela","Factura de agencia","Único dueño","2 llaves 🔑","156,000 km"]'::jsonb, 'assets/cars/page_35_img_2.jpeg', '["assets/cars/page_35_img_2.jpeg","assets/cars/page_35_img_3.jpeg","assets/cars/page_35_img_4.jpeg","assets/cars/page_35_img_5.jpeg"]'::jsonb, 'assets/cars/page_35_img_2.jpeg', 'assets/cars/page_35_img_2.jpeg');
INSERT INTO public.vehicles (id, branch_id, page, brand, model, year, category, price_contado, price_financiado, price_num, status, specs, cover_photo, real_photos, cutout_photo, main_photo)
VALUES ('autohaus-p36', 1, 36, 'BMW', 'X6 Sport', 2020, 'SUV''S', '$999,000', '$1,009,000', 999000, 'disponible', '["Automática","Eléctrica","Asientos en piel","Cámara de reversa","Quemacocos","6 cil TwinPower Turbo","78,000 km","Factura de agencia","2 llaves"]'::jsonb, 'assets/cars/page_36_img_2.jpeg', '["assets/cars/page_36_img_2.jpeg","assets/cars/page_36_img_3.jpeg","assets/cars/page_36_img_4.jpeg","assets/cars/page_36_img_5.jpeg"]'::jsonb, 'assets/cars/page_36_img_2.jpeg', 'assets/cars/page_36_img_2.jpeg');
INSERT INTO public.vehicles (id, branch_id, page, brand, model, year, category, price_contado, price_financiado, price_num, status, specs, cover_photo, real_photos, cutout_photo, main_photo)
VALUES ('autohaus-p37', 2, 37, 'Ford', 'Territory Titanium', 2024, 'SUV''S', '$479,000', '$489,000', 479000, 'disponible', '["Automática","Eléctrica","Asientos en piel bi-tono","Quemacocos","Cámara de reversa","33,000 km","Factura de agencia","1 dueño","Motor 1.8L Turbo 4 cil"]'::jsonb, 'assets/cars/page_37_img_2.jpeg', '["assets/cars/page_37_img_2.jpeg","assets/cars/page_37_img_3.jpeg","assets/cars/page_37_img_4.jpeg","assets/cars/page_37_img_5.jpeg"]'::jsonb, 'assets/cars/page_37_img_2.jpeg', 'assets/cars/page_37_img_2.jpeg');
INSERT INTO public.vehicles (id, branch_id, page, brand, model, year, category, price_contado, price_financiado, price_num, status, specs, cover_photo, real_photos, cutout_photo, main_photo)
VALUES ('autohaus-p38', 1, 38, 'Mercedes-Benz', 'GLC 300', 2019, 'SUV''S', '$430,000', '$440,000', 430000, 'disponible', '["Automática","Eléctrica","Asientos en piel","Cámara de reversa","Factura de agencia","78,000 km","Motor 4 cil 2.0 Turbo"]'::jsonb, 'assets/cars/page_38_img_2.jpeg', '["assets/cars/page_38_img_2.jpeg","assets/cars/page_38_img_3.jpeg","assets/cars/page_38_img_4.jpeg","assets/cars/page_38_img_5.jpeg"]'::jsonb, 'assets/cars/page_38_img_2.jpeg', 'assets/cars/page_38_img_2.jpeg');
INSERT INTO public.vehicles (id, branch_id, page, brand, model, year, category, price_contado, price_financiado, price_num, status, specs, cover_photo, real_photos, cutout_photo, main_photo)
VALUES ('autohaus-p39', 2, 39, 'Peugeot', '3008 Active', 2023, 'SUV''S', '$359,000', '$369,000', 359000, 'disponible', '["Automática","Eléctrica","Asientos en tela","Cámara de reversa","73,000 km","Factura de empresa","1 llave 🔑"]'::jsonb, 'assets/cars/page_39_img_2.jpeg', '["assets/cars/page_39_img_2.jpeg","assets/cars/page_39_img_3.jpeg","assets/cars/page_39_img_4.jpeg","assets/cars/page_39_img_5.jpeg"]'::jsonb, 'assets/cars/page_39_img_2.jpeg', 'assets/cars/page_39_img_2.jpeg');
INSERT INTO public.vehicles (id, branch_id, page, brand, model, year, category, price_contado, price_financiado, price_num, status, specs, cover_photo, real_photos, cutout_photo, main_photo)
VALUES ('autohaus-p40', 1, 40, 'Jeep', 'Grand Cherokee Trackhawk', 2018, 'SUV''S', '$1,400,000', '$1,400,000', 1400000, 'disponible', '["Asientos en Alcántara","Eléctrica","Cámara de reversa","4x4","42,000 km","AWD","Motor 8 cil 6.2L Súpercargado","Launch Control","Filtro de alto flujo JLT","Tubería Borla","Polea del súper cargador","Reprogramada HP Tuners","Termostato de 160°","Resortes Lowering Kit Eibach","Importada (D)"]'::jsonb, 'assets/cars/page_40_img_2.jpeg', '["assets/cars/page_40_img_2.jpeg","assets/cars/page_40_img_3.jpeg","assets/cars/page_40_img_4.jpeg","assets/cars/page_40_img_5.jpeg"]'::jsonb, 'assets/cars/page_40_img_2.jpeg', 'assets/cars/page_40_img_2.jpeg');
INSERT INTO public.vehicles (id, branch_id, page, brand, model, year, category, price_contado, price_financiado, price_num, status, specs, cover_photo, real_photos, cutout_photo, main_photo)
VALUES ('autohaus-p42', 2, 42, 'Mitsubishi', 'L200', 2022, 'SUV''S', '$335,000', '$345,000', 335000, 'disponible', '["Transmisión manual","Eléctrica","Asientos en tela","4x2","Factura de empresa","Único dueño","1 llave","130,000 km"]'::jsonb, 'assets/cars/page_42_img_2.jpeg', '["assets/cars/page_42_img_2.jpeg","assets/cars/page_42_img_3.jpeg","assets/cars/page_42_img_4.jpeg","assets/cars/page_42_img_5.jpeg"]'::jsonb, 'assets/cars/page_42_img_2.jpeg', 'assets/cars/page_42_img_2.jpeg');
INSERT INTO public.vehicles (id, branch_id, page, brand, model, year, category, price_contado, price_financiado, price_num, status, specs, cover_photo, real_photos, cutout_photo, main_photo)
VALUES ('autohaus-p43', 1, 43, 'Peugeot', 'Partner Maxi', 2018, 'SUV''S', '$215,000', '$225,000', 215000, 'disponible', '["Factura de agencia","Un dueño","Transmisión manual (Std)","Eléctrica","A/C","Capacidad de carga 2 toneladas","4 puertas","193,000 km"]'::jsonb, 'assets/cars/page_43_img_2.jpeg', '["assets/cars/page_43_img_2.jpeg","assets/cars/page_43_img_3.jpeg","assets/cars/page_43_img_4.jpeg","assets/cars/page_43_img_5.jpeg"]'::jsonb, 'assets/cars/page_43_img_2.jpeg', 'assets/cars/page_43_img_2.jpeg');
INSERT INTO public.vehicles (id, branch_id, page, brand, model, year, category, price_contado, price_financiado, price_num, status, specs, cover_photo, real_photos, cutout_photo, main_photo)
VALUES ('autohaus-p44', 2, 44, 'Peugeot', 'Partner Maxi Pack', 2021, 'SUV''S', '$279,000', '$289,000', 279000, 'disponible', '["Transmisión manual","A/C","Asientos en tela","Estéreo","Modos de manejo","Faros de niebla","Puerta lateral corrediza","Motor 1.6 Turbo Diesel","Capacidad de carga 950 kg","120,000 km","Factura de seminuevos de agencia"]'::jsonb, 'assets/cars/page_44_img_2.jpeg', '["assets/cars/page_44_img_2.jpeg","assets/cars/page_44_img_3.jpeg","assets/cars/page_44_img_4.jpeg","assets/cars/page_44_img_5.jpeg"]'::jsonb, 'assets/cars/page_44_img_2.jpeg', 'assets/cars/page_44_img_2.jpeg');
INSERT INTO public.vehicles (id, branch_id, page, brand, model, year, category, price_contado, price_financiado, price_num, status, specs, cover_photo, real_photos, cutout_photo, main_photo)
VALUES ('autohaus-p45', 1, 45, 'Chevrolet', 'Traverse LT', 2021, 'SUV''S', '$505,000', '$515,000', 505000, 'disponible', '["Automática","Eléctrica","Asientos en piel","7 pasajeros","Cámara de reversa","Cámara 360°","Quemacocos","Techo panorámico","72,000 km","Factura de agencia","Único dueño"]'::jsonb, 'assets/cars/page_45_img_2.jpeg', '["assets/cars/page_45_img_2.jpeg","assets/cars/page_45_img_3.jpeg","assets/cars/page_45_img_4.jpeg","assets/cars/page_45_img_5.jpeg"]'::jsonb, 'assets/cars/page_45_img_2.jpeg', 'assets/cars/page_45_img_2.jpeg');
INSERT INTO public.vehicles (id, branch_id, page, brand, model, year, category, price_contado, price_financiado, price_num, status, specs, cover_photo, real_photos, cutout_photo, main_photo)
VALUES ('autohaus-p46', 2, 46, 'GMC', 'Terrain Denali', 2020, 'SUV''S', '$379,000', '$389,000', 379000, 'disponible', '["Automática","Eléctrica","Asientos en piel","Cámara de reversa","Quemacocos","Factura de agencia","1 dueño","137,000 km"]'::jsonb, 'assets/cars/page_46_img_2.jpeg', '["assets/cars/page_46_img_2.jpeg","assets/cars/page_46_img_3.jpeg","assets/cars/page_46_img_4.jpeg","assets/cars/page_46_img_5.jpeg"]'::jsonb, 'assets/cars/page_46_img_2.jpeg', 'assets/cars/page_46_img_2.jpeg');
INSERT INTO public.vehicles (id, branch_id, page, brand, model, year, category, price_contado, price_financiado, price_num, status, specs, cover_photo, real_photos, cutout_photo, main_photo)
VALUES ('autohaus-p47', 1, 47, 'Jeep', 'Grand Cherokee Limited Lujo', 2015, 'SUV''S', '$245,000', '$255,000', 245000, 'disponible', '["Motor V6 3.6L","Automática","Eléctrica","Asientos en piel","Navegador","Quemacocos","Cámara de reversa","132,000 km","Factura de seminuevos de agencia","2 llaves 🔑"]'::jsonb, 'assets/cars/page_47_img_2.jpeg', '["assets/cars/page_47_img_2.jpeg","assets/cars/page_47_img_3.jpeg","assets/cars/page_47_img_4.jpeg","assets/cars/page_47_img_5.jpeg"]'::jsonb, 'assets/cars/page_47_img_2.jpeg', 'assets/cars/page_47_img_2.jpeg');
INSERT INTO public.vehicles (id, branch_id, page, brand, model, year, category, price_contado, price_financiado, price_num, status, specs, cover_photo, real_photos, cutout_photo, main_photo)
VALUES ('autohaus-p48', 2, 48, 'Audi', 'Q5 Élite Quattro', 2013, 'SUV''S', '$219,000', '$219,000', 219000, 'disponible', '["100% mexicana","Llantas nuevas","Perfectas condiciones","165,000 km","Techo panorámico","Botón de encendido","Factura de seminuevos"]'::jsonb, 'assets/cars/page_48_img_2.jpeg', '["assets/cars/page_48_img_2.jpeg","assets/cars/page_48_img_3.jpeg","assets/cars/page_48_img_4.jpeg","assets/cars/page_48_img_5.jpeg"]'::jsonb, 'assets/cars/page_48_img_2.jpeg', 'assets/cars/page_48_img_2.jpeg');
INSERT INTO public.vehicles (id, branch_id, page, brand, model, year, category, price_contado, price_financiado, price_num, status, specs, cover_photo, real_photos, cutout_photo, main_photo)
VALUES ('autohaus-p49', 1, 49, 'Ford', 'EcoSport Titanium', 2019, 'SUV''S', '$239,000', '$249,000', 239000, 'disponible', '["Factura de agencia","Dos llaves","Llantas nuevas","Automática","Eléctrica","Cámara de reversa","Asientos en piel","Quemacocos","Pantalla","76,000 km"]'::jsonb, 'assets/cars/page_49_img_2.jpeg', '["assets/cars/page_49_img_2.jpeg","assets/cars/page_49_img_3.jpeg","assets/cars/page_49_img_4.jpeg","assets/cars/page_49_img_5.jpeg"]'::jsonb, 'assets/cars/page_49_img_2.jpeg', 'assets/cars/page_49_img_2.jpeg');
INSERT INTO public.vehicles (id, branch_id, page, brand, model, year, category, price_contado, price_financiado, price_num, status, specs, cover_photo, real_photos, cutout_photo, main_photo)
VALUES ('autohaus-p50', 2, 50, 'Nissan', 'Kicks Exclusive', 2018, 'SUV''S', '$239,000', '$249,000', 239000, 'disponible', '["Automática","Eléctrica","Asientos en piel","Cámara de reversa","Visión panorámica","Tacómetro digital","103,000 km"]'::jsonb, 'assets/cars/page_50_img_2.jpeg', '["assets/cars/page_50_img_2.jpeg","assets/cars/page_50_img_3.jpeg","assets/cars/page_50_img_4.jpeg","assets/cars/page_50_img_5.jpeg"]'::jsonb, 'assets/cars/page_50_img_2.jpeg', 'assets/cars/page_50_img_2.jpeg');
INSERT INTO public.vehicles (id, branch_id, page, brand, model, year, category, price_contado, price_financiado, price_num, status, specs, cover_photo, real_photos, cutout_photo, main_photo)
VALUES ('autohaus-p51', 1, 51, 'Mazda', 'CX-9 Signature', 2019, 'SUV''S', '$420,000', '$430,000', 420000, 'disponible', '["Automática","Eléctrica","Asientos en piel color vino","Cámara de reversa","7 pasajeros","Quemacocos","AWD","108,000 km","Todos sus servicios en la agencia"]'::jsonb, 'assets/cars/page_51_img_2.jpeg', '["assets/cars/page_51_img_2.jpeg","assets/cars/page_51_img_3.jpeg","assets/cars/page_51_img_4.jpeg","assets/cars/page_51_img_5.jpeg"]'::jsonb, 'assets/cars/page_51_img_2.jpeg', 'assets/cars/page_51_img_2.jpeg');
INSERT INTO public.vehicles (id, branch_id, page, brand, model, year, category, price_contado, price_financiado, price_num, status, specs, cover_photo, real_photos, cutout_photo, main_photo)
VALUES ('autohaus-p53', 2, 53, 'GMC', 'Sierra SLT 2500 HD', 2021, 'PICK UPS', '$1,050,000', '$1,060,000', 1050000, 'disponible', '["Importada por pedimento","Asientos en piel","Quemacocos","8 birlos","4x4","104,000 millas","Cámara de reversa"]'::jsonb, 'assets/cars/page_53_img_2.jpeg', '["assets/cars/page_53_img_2.jpeg","assets/cars/page_53_img_3.jpeg","assets/cars/page_53_img_4.jpeg","assets/cars/page_53_img_5.jpeg"]'::jsonb, 'assets/cars/page_53_img_2.jpeg', 'assets/cars/page_53_img_2.jpeg');
INSERT INTO public.vehicles (id, branch_id, page, brand, model, year, category, price_contado, price_financiado, price_num, status, specs, cover_photo, real_photos, cutout_photo, main_photo)
VALUES ('autohaus-p54', 1, 54, 'Chevrolet', 'Silverado Custom', 2022, 'PICK UPS', '$665,000', '$675,000', 665000, 'disponible', '["Automática","Eléctrica","Asientos en tela","4x4","83,000 km","Factura de seminuevos","Motor 8 cil"]'::jsonb, 'assets/cars/page_54_img_2.jpeg', '["assets/cars/page_54_img_2.jpeg","assets/cars/page_54_img_3.jpeg","assets/cars/page_54_img_4.jpeg","assets/cars/page_54_img_5.jpeg"]'::jsonb, 'assets/cars/page_54_img_2.jpeg', 'assets/cars/page_54_img_2.jpeg');
INSERT INTO public.vehicles (id, branch_id, page, brand, model, year, category, price_contado, price_financiado, price_num, status, specs, cover_photo, real_photos, cutout_photo, main_photo)
VALUES ('autohaus-p55', 2, 55, 'Chevrolet', 'Cheyenne RST', 2019, 'PICK UPS', '$665,000', '$675,000', 665000, 'disponible', '["Automática","Eléctrica","4x4","Asientos en tela","Cámara de reversa","Pantalla touch","Factura de seminuevos de agencia","1 llave","90,000 km"]'::jsonb, 'assets/cars/page_55_img_2.jpeg', '["assets/cars/page_55_img_2.jpeg","assets/cars/page_55_img_3.jpeg","assets/cars/page_55_img_4.jpeg","assets/cars/page_55_img_5.jpeg"]'::jsonb, 'assets/cars/page_55_img_2.jpeg', 'assets/cars/page_55_img_2.jpeg');
INSERT INTO public.vehicles (id, branch_id, page, brand, model, year, category, price_contado, price_financiado, price_num, status, specs, cover_photo, real_photos, cutout_photo, main_photo)
VALUES ('autohaus-p57', 1, 57, 'Renault', 'Oroch Intense', 2019, 'PICK UPS', '$260,000', '$270,000', 260000, 'disponible', '["Transmisión automática","Eléctrica","Asientos en tela","Quemacocos","Única dueña","1 llave","90,000 km","Factura de agencia"]'::jsonb, 'assets/cars/page_57_img_2.jpeg', '["assets/cars/page_57_img_2.jpeg","assets/cars/page_57_img_3.jpeg","assets/cars/page_57_img_4.jpeg","assets/cars/page_57_img_5.jpeg"]'::jsonb, 'assets/cars/page_57_img_2.jpeg', 'assets/cars/page_57_img_2.jpeg');
INSERT INTO public.vehicles (id, branch_id, page, brand, model, year, category, price_contado, price_financiado, price_num, status, specs, cover_photo, real_photos, cutout_photo, main_photo)
VALUES ('autohaus-p58', 2, 58, 'RAM', '1500 Laramie Sport', 2020, 'PICK UPS', '$720,000', '$730,000', 720000, 'disponible', '["1500 Mild Hybrid","110,000 km","Asientos en piel / gamuza","4x4","8 cil 5.7L","Quemacocos","Cámara de reversa","Pantalla larga","Factura de seminuevos","Garantía hasta 2027","Llantas nuevas Michelin","Tapa batea","2 llaves"]'::jsonb, 'assets/cars/page_58_img_2.jpeg', '["assets/cars/page_58_img_2.jpeg","assets/cars/page_58_img_3.jpeg","assets/cars/page_58_img_4.jpeg","assets/cars/page_58_img_5.jpeg"]'::jsonb, 'assets/cars/page_58_img_2.jpeg', 'assets/cars/page_58_img_2.jpeg');
INSERT INTO public.vehicles (id, branch_id, page, brand, model, year, category, price_contado, price_financiado, price_num, status, specs, cover_photo, real_photos, cutout_photo, main_photo)
VALUES ('autohaus-p59', 1, 59, 'Chevrolet', 'Cheyenne LT', 2023, 'PICK UPS', '$825,000', '$835,000', 825000, 'disponible', '["Automática","Eléctrica","Asientos en tela","50,000 km","4x4","Factura de agencia","1 dueño","2 llaves 🔑"]'::jsonb, 'assets/cars/page_59_img_2.jpeg', '["assets/cars/page_59_img_2.jpeg","assets/cars/page_59_img_3.jpeg","assets/cars/page_59_img_4.jpeg","assets/cars/page_59_img_5.jpeg"]'::jsonb, 'assets/cars/page_59_img_2.jpeg', 'assets/cars/page_59_img_2.jpeg');
INSERT INTO public.vehicles (id, branch_id, page, brand, model, year, category, price_contado, price_financiado, price_num, status, specs, cover_photo, real_photos, cutout_photo, main_photo)
VALUES ('autohaus-p60', 2, 60, 'RAM', '1500 Big Horn', 2022, 'PICK UPS', '$755,000', '$765,000', 755000, 'disponible', '["57,000 km","4x4","Motor Pentastar eTorque Mild Hybrid V6 3.6L 305hp","Interiores en tela","Cámara de reversa","Todos los servicios en la agencia","Factura de empresa","Un dueño"]'::jsonb, 'assets/cars/page_60_img_2.jpeg', '["assets/cars/page_60_img_2.jpeg","assets/cars/page_60_img_3.jpeg","assets/cars/page_60_img_4.jpeg","assets/cars/page_60_img_5.jpeg"]'::jsonb, 'assets/cars/page_60_img_2.jpeg', 'assets/cars/page_60_img_2.jpeg');
INSERT INTO public.vehicles (id, branch_id, page, brand, model, year, category, price_contado, price_financiado, price_num, status, specs, cover_photo, real_photos, cutout_photo, main_photo)
VALUES ('autohaus-p61', 1, 61, 'RAM', '1500 Limited', 2021, 'PICK UPS', '$860,000', '$870,000', 860000, 'disponible', '["Automática","Eléctrica","Asientos en piel","Pantalla larga","Quemacocos","Cámara de reversa","4x4","Suspensión de aire","69,000 km"]'::jsonb, 'assets/cars/page_61_img_2.jpeg', '["assets/cars/page_61_img_2.jpeg","assets/cars/page_61_img_3.jpeg","assets/cars/page_61_img_4.jpeg","assets/cars/page_61_img_5.jpeg"]'::jsonb, 'assets/cars/page_61_img_2.jpeg', 'assets/cars/page_61_img_2.jpeg');
INSERT INTO public.vehicles (id, branch_id, page, brand, model, year, category, price_contado, price_financiado, price_num, status, specs, cover_photo, real_photos, cutout_photo, main_photo)
VALUES ('autohaus-p62', 2, 62, 'RAM', '1500 Big Horn', 2022, 'PICK UPS', '$860,000', '$870,000', 860000, 'disponible', '["57,000 km","4x4","Motor Pentastar eTorque Mild Hybrid V6 3.6L 305hp","Interiores en tela","Cámara de reversa","Todos los servicios en la agencia","Factura de empresa","Un dueño"]'::jsonb, 'assets/cars/page_62_img_2.jpeg', '["assets/cars/page_62_img_2.jpeg","assets/cars/page_62_img_3.jpeg","assets/cars/page_62_img_4.jpeg","assets/cars/page_62_img_5.jpeg"]'::jsonb, 'assets/cars/page_62_img_2.jpeg', 'assets/cars/page_62_img_2.jpeg');
INSERT INTO public.vehicles (id, branch_id, page, brand, model, year, category, price_contado, price_financiado, price_num, status, specs, cover_photo, real_photos, cutout_photo, main_photo)
VALUES ('autohaus-p63', 1, 63, 'Chevrolet', 'Cheyenne Clásica', 1990, 'PICK UPS', '$385,000', '$385,000', 385000, 'disponible', '["Motor Vortec","Frenos de disco traseros","Diferencial positivo","Repro en la computadora","Headers","Llantas nuevas","Rines 22","Aire acondicionado","Interior impecable","Equipo de sonido JL todo clase D competition","Pantalla Alpine"]'::jsonb, 'assets/cars/page_63_img_2.jpeg', '["assets/cars/page_63_img_2.jpeg","assets/cars/page_63_img_3.jpeg","assets/cars/page_63_img_4.jpeg","assets/cars/page_63_img_5.jpeg"]'::jsonb, 'assets/cars/page_63_img_2.jpeg', 'assets/cars/page_63_img_2.jpeg');
INSERT INTO public.vehicles (id, branch_id, page, brand, model, year, category, price_contado, price_financiado, price_num, status, specs, cover_photo, real_photos, cutout_photo, main_photo)
VALUES ('autohaus-p64', 2, 64, 'Ford', 'Lobo Raptor R', 2025, 'PICK UPS', '$2,580,000', '$2,590,000', 2580000, 'disponible', '["20,000 km","Factura de seminuevos","Asientos en Alcántara","Todos sus servicios en la agencia","4x4","Motor V8 5.2L Supercharged","Filtro de alto flujo","Polea de súper cargador","Banda de accesorios uso rudo","Repro en motor y transmisión","Tapa en caja sólida","Tubería de acero inoxidable"]'::jsonb, 'assets/cars/page_64_img_2.jpeg', '["assets/cars/page_64_img_2.jpeg","assets/cars/page_64_img_3.jpeg","assets/cars/page_64_img_4.jpeg","assets/cars/page_64_img_5.jpeg"]'::jsonb, 'assets/cars/page_64_img_2.jpeg', 'assets/cars/page_64_img_2.jpeg');
INSERT INTO public.vehicles (id, branch_id, page, brand, model, year, category, price_contado, price_financiado, price_num, status, specs, cover_photo, real_photos, cutout_photo, main_photo)
VALUES ('autohaus-p65', 1, 65, 'Volkswagen', 'Amarok Highline', 2015, 'PICK UPS', '$249,000', '$259,000', 249000, 'disponible', '["Factura de seminuevos","216,000 km","Asientos en piel","Automática","4x4"]'::jsonb, 'assets/cars/page_65_img_2.jpeg', '["assets/cars/page_65_img_2.jpeg","assets/cars/page_65_img_3.jpeg","assets/cars/page_65_img_4.jpeg","assets/cars/page_65_img_5.jpeg"]'::jsonb, 'assets/cars/page_65_img_2.jpeg', 'assets/cars/page_65_img_2.jpeg');
INSERT INTO public.vehicles (id, branch_id, page, brand, model, year, category, price_contado, price_financiado, price_num, status, specs, cover_photo, real_photos, cutout_photo, main_photo)
VALUES ('autohaus-p67', 2, 67, 'Mercedes-Benz', 'S500 Wald Black', 2018, 'DEPORTIVOS', '$1,100,000', '$1,100,000', 1100000, 'disponible', '["Full catback","Intakes","Repro","Bodykit WALD","55,000 km","Techo panorámico","Mexicano 100%","Motor V8 biturbo 4.6L"]'::jsonb, 'assets/cars/page_67_img_2.jpeg', '["assets/cars/page_67_img_2.jpeg","assets/cars/page_67_img_3.jpeg","assets/cars/page_67_img_4.jpeg","assets/cars/page_67_img_5.jpeg"]'::jsonb, 'assets/cars/page_67_img_2.jpeg', 'assets/cars/page_67_img_2.jpeg');
INSERT INTO public.vehicles (id, branch_id, page, brand, model, year, category, price_contado, price_financiado, price_num, status, specs, cover_photo, real_photos, cutout_photo, main_photo)
VALUES ('autohaus-p68', 1, 68, 'Audi', 'RS5 Sportback Quattro', 2021, 'DEPORTIVOS', '$1,060,000', '$1,070,000', 1060000, 'disponible', '["4 puertas","Automático","Eléctrico","Asientos en piel","Cámara de reversa","Quemacocos","Transmisión Quattro","1 llave 🔑","50,000 km","Motor V6 2.9L bi-turbo","Factura de seminuevos Audi"]'::jsonb, 'assets/cars/page_68_img_2.jpeg', '["assets/cars/page_68_img_2.jpeg","assets/cars/page_68_img_3.jpeg","assets/cars/page_68_img_4.jpeg","assets/cars/page_68_img_5.jpeg"]'::jsonb, 'assets/cars/page_68_img_2.jpeg', 'assets/cars/page_68_img_2.jpeg');
INSERT INTO public.vehicles (id, branch_id, page, brand, model, year, category, price_contado, price_financiado, price_num, status, specs, cover_photo, real_photos, cutout_photo, main_photo)
VALUES ('autohaus-p69', 2, 69, 'McLaren', '540C V8 Twin Turbo', 2017, 'DEPORTIVOS', '$1,350,000', '$1,350,000', 1350000, 'disponible', '["Asientos en Alcántara","21,000 km","Motor V8 3.8L biturbo","Transmisión secuencial de doble embrague","Chasis monocasco de fibra de carbono"]'::jsonb, 'assets/cars/page_69_img_2.jpeg', '["assets/cars/page_69_img_2.jpeg","assets/cars/page_69_img_3.jpeg","assets/cars/page_69_img_4.jpeg","assets/cars/page_69_img_5.jpeg"]'::jsonb, 'assets/cars/page_69_img_2.jpeg', 'assets/cars/page_69_img_2.jpeg');

-- SEED LEADS
INSERT INTO public.leads (id, client_id, vehicle_id, sales_rep_id, client_name, client_phone, client_email, vehicle_page, vehicle_name, assigned_to, assigned_name, status, notes)
VALUES 
  ('lead_1788213657396', 2, 'autohaus-p8', 2, 'Roberto Domínguez', '6141998877', 'roberto@ejemplo.com', 8, 'Chevrolet Beat LT Hatchback 2021', 'javier@autohaus.mx', 'Javier', 'nuevo', 'Plan: Financiamiento / Crédito (desde 20% enganche) | Mensaje: ¿Tienen entrega inmediata en San Felipe?'),
  ('lead_1788031819047', 3, 'autohaus-p9', 1, 'Alejandro Morales', '6147771234', 'alejandro@ejemplo.com', 9, 'Mazda 3 Grand Touring 2023', 'napo@autohaus.mx', 'Napo', 'nuevo', 'Cliente busca enganche del 25% y entrega en sucursal San Felipe.'),
  ('lead_3', 4, 'autohaus-p13', 2, 'Roberto Alvídrez', '6145558899', 'alvidrez@ejemplo.com', 13, 'Audi A3 Select 2018', 'javier@autohaus.mx', 'Javier', 'nuevo', 'Pregunta por toma a cuenta de camioneta Ranger 2018 + enganche en efectivo.'),
  ('lead_4', 5, 'autohaus-p10', 4, 'David Ochoa', '6143332211', 'david@ejemplo.com', 10, 'Nissan Sentra Advance 2017', 'raul@autohaus.mx', 'Raúl', 'nuevo', 'Interesado en financiamiento entre particulares o compra directa.'),
  ('lead_2', 6, 'autohaus-p14', 3, 'Mariana Garza', '6149876543', 'mariana@ejemplo.com', 14, 'Kia Rio EX Pack 2023', 'fernanda@autohaus.mx', 'Fernanda', 'cita', 'Cita programada para prueba de manejo el sábado a las 11:00 AM en Sucursal San Felipe.'),
  ('lead_1', 1, 'autohaus-p7', 1, 'Carlos Mendoza', '6141234567', 'cliente_test_1788220562010@ejemplo.com', 7, 'Nissan Sentra Sense 2018', 'napo@autohaus.mx', 'Napo', 'contactado', 'Cliente busca plan a 36 meses con 35% de enganche. Ya se le mandó cotización.');

-- SEED VEHICLE STATUS HISTORY
INSERT INTO public.vehicle_status_history (id, vehicle_id, status, previous_status, client_id, sales_rep_id, deposit_amount, notes)
SELECT 
  'hist_' || id,
  id,
  status,
  'ingreso_inventario',
  NULL,
  NULL,
  '',
  'Ingreso inicial certificado a inventario de sucursal'
FROM public.vehicles;
