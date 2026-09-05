const fs = require('fs');
const path = require('path');

// Ground truth extracted from Heyzine 84edf79c22.pdf
// Page numbers map directly to assets/cars/page_{N}_img_2.jpeg
const rawCatalog = [
  // ==================== SEDANES Y HATCHBACKS (Pages 4 to 23) ====================
  {
    page: 4,
    category: 'SEDAN & HATCHBACK',
    brand: 'Chevrolet',
    model: 'Beat LT',
    year: 2020,
    price_contado: '$195,000',
    price_financiado: '$205,000',
    specs: ['Automático', 'Eléctrico', 'Asientos en tela', '121,000 km', 'Factura de agencia', '1 dueño', '2 llaves 🔑']
  },
  {
    page: 5,
    category: 'SEDAN & HATCHBACK',
    brand: 'Mazda',
    model: 'Mazda 6 Signature',
    year: 2019,
    price_contado: '$339,000',
    price_financiado: '$349,000',
    specs: ['Motor 2.5 turbo', 'Factura de agencia', 'Único dueño', 'Dos llaves', '90,000 km', 'CarPlay inalámbrico']
  },
  {
    page: 6,
    category: 'SEDAN & HATCHBACK',
    brand: 'Nissan',
    model: 'Versa Advance',
    year: 2022,
    price_contado: '$269,000',
    price_financiado: '$279,000',
    specs: ['Automático', 'Eléctrico', 'Asientos en tela', 'Cámara de reversa', 'Pantalla touch', '46,000 km']
  },
  {
    page: 7,
    category: 'SEDAN & HATCHBACK',
    brand: 'Nissan',
    model: 'Sentra Sense',
    year: 2018,
    price_contado: '$185,000',
    price_financiado: '$195,000',
    specs: ['Automático', 'Eléctrico', 'Asientos en tela', '76,000 km', 'Factura de seminuevos autotokio']
  },
  {
    page: 8,
    category: 'SEDAN & HATCHBACK',
    brand: 'Chevrolet',
    model: 'Beat LT Hatchback',
    year: 2021,
    price_contado: '$175,000',
    price_financiado: '$185,000',
    specs: ['Transmisión manual', 'Vidrios delanteros eléctricos', 'Vidrios traseros manuales', 'Asientos en tela', '125,000 km', 'Factura de agencia', '1 dueño', '2 llaves']
  },
  {
    page: 9,
    category: 'SEDAN & HATCHBACK',
    brand: 'Mazda',
    model: 'Mazda 3 Grand Touring',
    year: 2023,
    price_contado: '$360,000',
    price_financiado: '$370,000',
    specs: ['Factura de agencia', 'Único dueño', '73,000 km']
  },
  {
    page: 10,
    category: 'SEDAN & HATCHBACK',
    brand: 'Nissan',
    model: 'Sentra Advance',
    year: 2017,
    price_contado: '$185,000',
    price_financiado: '$195,000',
    specs: ['Automático', 'Eléctrico', 'Asientos en tela', 'Pantalla touch con Apple CarPlay y Android Auto', 'Cámara de reversa', 'Factura de agencia', '2 llaves', '124,000 km']
  },
  {
    page: 11,
    category: 'SEDAN & HATCHBACK',
    brand: 'Hyundai',
    model: 'Grand i10 GLS',
    year: 2017,
    price_contado: '$159,000',
    price_financiado: '$169,000',
    specs: ['Automático', 'Asientos en tela', 'Eléctrico', 'A/C', 'Rines', 'Factura de seminuevos de agencia', '1 llave 🔑', '138,000 km']
  },
  {
    page: 12,
    category: 'SEDAN & HATCHBACK',
    brand: 'Mercedes-Benz',
    model: 'C280',
    year: 2008,
    price_contado: '$115,000',
    price_financiado: '$115,000',
    specs: ['Factura de seminuevos', '100% mexicano', 'Asientos en piel', 'Automático', 'Eléctrico', 'Quemacocos', 'Motor V6', '1 llave 🔑']
  },
  {
    page: 13,
    category: 'SEDAN & HATCHBACK',
    brand: 'Audi',
    model: 'A3 Select',
    year: 2018,
    price_contado: '$275,000',
    price_financiado: '$285,000',
    specs: ['Automático', 'Eléctrico', 'Asientos en tela/piel', '1 llave', '165,000 km', 'Encendido de botón']
  },
  {
    page: 14,
    category: 'SEDAN & HATCHBACK',
    brand: 'Kia',
    model: 'Rio EX Pack',
    year: 2023,
    price_contado: '$290,000',
    price_financiado: '$300,000',
    specs: ['Automático', 'Eléctrico', '70,000 km', 'Factura de agencia', 'Único dueño', '1 llave', 'Asientos en piel', 'Cámara de reversa']
  },
  {
    page: 15,
    category: 'SEDAN & HATCHBACK',
    brand: 'Toyota',
    model: 'Prius C Hatchback',
    year: 2021,
    price_contado: '$255,000',
    price_financiado: '$265,000',
    specs: ['Híbrido', 'Automático', 'Eléctrico', 'Asientos en tela', '70,000 km', 'Factura de empresa', '1 llave 🔑']
  },
  {
    page: 16,
    category: 'SEDAN & HATCHBACK',
    brand: 'Chevrolet',
    model: 'Beat LT',
    year: 2019,
    price_contado: '$160,000',
    price_financiado: '$170,000',
    specs: ['Transmisión manual', 'Semi eléctrico', '80,000 km', 'Factura de agencia', '1 dueño', 'Asientos en tela', '2 llaves', 'Motor 4 cil. 1.2 litros']
  },
  {
    page: 17,
    category: 'SEDAN & HATCHBACK',
    brand: 'Volkswagen',
    model: 'Jetta Comfortline',
    year: 2025,
    price_contado: '$399,000',
    price_financiado: '$409,000',
    specs: ['Automático', 'Eléctrico', 'Asientos en tela', 'Cámara de reversa', '14,000 km', 'Factura de agencia', 'Único dueño', '2 llaves 🔑']
  },
  {
    page: 18,
    category: 'SEDAN & HATCHBACK',
    brand: 'Chevrolet',
    model: 'Beat LTZ',
    year: 2018,
    price_contado: '$150,000',
    price_financiado: '$160,000',
    specs: ['Asientos en tela', 'Transmisión manual', 'Eléctrico', 'Pantalla touch', '88,000 km', 'Factura de agencia', '2 dueños', '2 llaves', 'Rines', 'A/C', 'NUNCA UBER/DIDI', 'IMPECABLE!!!']
  },
  {
    page: 19,
    category: 'SEDAN & HATCHBACK',
    brand: 'Mercedes-Benz',
    model: 'S500 Wald Black',
    year: 2015,
    price_contado: '$1,100,000',
    price_financiado: '$1,100,000',
    specs: ['Full catback', 'Intakes', 'Repro', 'Bodykit WALD', '61,000 km', 'Techo panorámico', 'Mexicano 100%', 'Motor V8 biturbo 4.7L', 'Se toma una o dos unidades a cuenta']
  },
  {
    page: 20,
    category: 'SEDAN & HATCHBACK',
    brand: 'Nissan',
    model: 'Sentra Advance',
    year: 2020,
    price_contado: '$260,000',
    price_financiado: '$270,000',
    specs: ['Automático', 'Eléctrico', 'Asientos en tela', 'Cámara de reversa', 'Factura de agencia']
  },
  {
    page: 21,
    category: 'SEDAN & HATCHBACK',
    brand: 'Honda',
    model: 'City Prime',
    year: 2024,
    price_contado: '$330,000',
    price_financiado: '$340,000',
    specs: ['Automático', 'Eléctrico', 'Asientos en tela', 'Pantalla touch', 'Cámara de reversa', 'Cámara lateral', 'Factura de agencia', '18,000 km']
  },
  {
    page: 22,
    category: 'SEDAN & HATCHBACK',
    brand: 'Ford',
    model: 'Figo Energy',
    year: 2018,
    price_contado: '$130,000',
    price_financiado: '$140,000',
    specs: ['Automático', 'Vidrios manuales', 'Asientos en tela', '126,000 km']
  },
  {
    page: 23,
    category: 'SEDAN & HATCHBACK',
    brand: 'Nissan',
    model: 'Sentra Sense',
    year: 2022,
    price_contado: '$269,000',
    price_financiado: '$279,000',
    specs: ['Factura de agencia', 'Único dueño', 'Transmisión manual', 'Eléctrico', 'Asientos en tela', '82,000 km', '2 llaves 🔑']
  },

  // ==================== SUVS (Pages 25 to 51) ====================
  {
    page: 25,
    category: "SUV'S",
    brand: 'Mercedes-Benz',
    model: 'GLE 450',
    year: 2020,
    price_contado: '$620,000',
    price_financiado: '$630,000',
    specs: ['SUV', 'Automática', 'Eléctrica', 'Asientos en piel', 'Cámara de reversa', '3 filas de pasajeros', '152,000 km', 'Factura de agencia']
  },
  {
    page: 26,
    category: "SUV'S",
    brand: 'Hyundai',
    model: 'Creta Grand Limited',
    year: 2022,
    price_contado: '$395,000',
    price_financiado: '$405,000',
    specs: ['Automática', 'Eléctrica', 'Asientos en piel bi-tono', '46,000 km', 'Factura de seminuevos de agencia Hyundai', '3 filas de asientos (7 pasajeros)', 'Motor 4 cil 2.0L', '2 llaves 🔑']
  },
  {
    page: 27,
    category: "SUV'S",
    brand: 'Mazda',
    model: 'CX-9 Grand Touring',
    year: 2020,
    price_contado: '$455,000',
    price_financiado: '$465,000',
    specs: ['Automática', 'Eléctrica', 'Asientos en piel', '3 filas de asientos', 'Cámara de reversa', 'Quemacocos', 'Factura de seminuevos', '2 llaves 🔑']
  },
  {
    page: 28,
    category: "SUV'S",
    brand: 'Hyundai',
    model: 'Tucson Limited Tech Hybrid',
    year: 2025,
    price_contado: '$740,000',
    price_financiado: '$750,000',
    specs: ['Automática', 'Eléctrica', 'Asientos en piel', 'Quemacocos', 'Techo panorámico', 'Cámara de reversa', 'Cámara frontal', '7,000 km', 'Factura de agencia', '1 dueño']
  },
  {
    page: 29,
    category: "SUV'S",
    brand: 'Volkswagen',
    model: 'Teramont Cross Sport R-Line',
    year: 2024,
    price_contado: '$945,000',
    price_financiado: '$955,000',
    specs: ['Automática', 'Eléctrica', 'Asientos en piel bi-tono', 'Quemacocos', 'Cámara de reversa', 'Factura de agencia', 'Única dueña', '2 llaves 🔑', 'Servicios en la agencia', '15,000 km']
  },
  {
    page: 30,
    category: "SUV'S",
    brand: 'Hyundai',
    model: 'Tucson GLS',
    year: 2024,
    price_contado: '$485,000',
    price_financiado: '$495,000',
    specs: ['Automática', 'Eléctrica', 'Asientos en tela', 'Cámara de reversa', '40,000 km', 'Factura de agencia', '1 dueño', '2 llaves 🔑']
  },
  {
    page: 31,
    category: "SUV'S",
    brand: 'Porsche',
    model: 'Cayenne Coupe Turbo GT',
    year: 2024,
    price_contado: '$3,200,000',
    price_financiado: '$3,210,000',
    specs: ['Automática', 'Eléctrica', 'Asientos en tela/alcántara', 'Cámara de reversa / frontal', 'A/C doble zona', 'Factura de empresa', '16,000 km', 'Motor V8 4.0L Turbo 659 hp']
  },
  {
    page: 32,
    category: "SUV'S",
    brand: 'Mercedes-Benz',
    model: 'GLE 43 AMG Coupe',
    year: 2019,
    price_contado: '$750,000',
    price_financiado: '$760,000',
    specs: ['Automática', 'Eléctrica', 'Asientos en piel', 'Factura de agencia', '100,000 km', 'Motor V6 biturbo', 'Tracción 4MATIC', 'Cámara de reversa', 'Quemacocos', 'Rines Vossen', 'Iluminación LED en puertas']
  },
  {
    page: 33,
    category: "SUV'S",
    brand: 'Audi',
    model: 'Q3 Elite',
    year: 2018,
    price_contado: '$330,000',
    price_financiado: '$340,000',
    specs: ['Automática', 'Eléctrica', 'Asientos en piel', 'Factura de agencia', '103,000 km', 'Motor 4 cil. 2.0L', 'Quemacocos', '2 llaves', 'Único dueño']
  },
  {
    page: 34,
    category: "SUV'S",
    brand: 'Audi',
    model: 'Q5 Elite',
    year: 2020,
    price_contado: '$495,000',
    price_financiado: '$505,000',
    specs: ['Asientos en piel', 'Cámara de reversa', 'Quemacocos', 'Cluster digital', 'Factura de agencia', 'Única dueña', '56,000 km', 'Motor 2.0 Turbo', 'Tracción Quattro']
  },
  {
    page: 35,
    category: "SUV'S",
    brand: 'Mazda',
    model: 'CX-9 Grand Touring',
    year: 2020,
    price_contado: '$455,000',
    price_financiado: '$465,000',
    specs: ['Automática', 'Eléctrica', 'Asientos en tela', 'Factura de agencia', 'Único dueño', '2 llaves 🔑', '156,000 km']
  },
  {
    page: 36,
    category: "SUV'S",
    brand: 'BMW',
    model: 'X6 Sport',
    year: 2020,
    price_contado: '$999,000',
    price_financiado: '$1,009,000',
    specs: ['Automática', 'Eléctrica', 'Asientos en piel', 'Cámara de reversa', 'Quemacocos', '6 cil TwinPower Turbo', '78,000 km', 'Factura de agencia', '2 llaves']
  },
  {
    page: 37,
    category: "SUV'S",
    brand: 'Ford',
    model: 'Territory Titanium',
    year: 2024,
    price_contado: '$479,000',
    price_financiado: '$489,000',
    specs: ['Automática', 'Eléctrica', 'Asientos en piel bi-tono', 'Quemacocos', 'Cámara de reversa', '33,000 km', 'Factura de agencia', '1 dueño', 'Motor 1.8L Turbo 4 cil']
  },
  {
    page: 38,
    category: "SUV'S",
    brand: 'Mercedes-Benz',
    model: 'GLC 300',
    year: 2019,
    price_contado: '$430,000',
    price_financiado: '$440,000',
    specs: ['Automática', 'Eléctrica', 'Asientos en piel', 'Cámara de reversa', 'Factura de agencia', '78,000 km', 'Motor 4 cil 2.0 Turbo']
  },
  {
    page: 39,
    category: "SUV'S",
    brand: 'Peugeot',
    model: '3008 Active',
    year: 2023,
    price_contado: '$359,000',
    price_financiado: '$369,000',
    specs: ['Automática', 'Eléctrica', 'Asientos en tela', 'Cámara de reversa', '73,000 km', 'Factura de empresa', '1 llave 🔑']
  },
  {
    page: 40,
    category: "SUV'S",
    brand: 'Jeep',
    model: 'Grand Cherokee Trackhawk',
    year: 2018,
    price_contado: '$1,400,000',
    price_financiado: '$1,400,000',
    specs: ['Asientos en Alcántara', 'Eléctrica', 'Cámara de reversa', '4x4', '42,000 km', 'AWD', 'Motor 8 cil 6.2L Súpercargado', 'Launch Control', 'Filtro de alto flujo JLT', 'Tubería Borla', 'Polea del súper cargador', 'Reprogramada HP Tuners', 'Termostato de 160°', 'Resortes Lowering Kit Eibach', 'Importada (D)']
  },
  {
    page: 41,
    category: "SUV'S",
    brand: 'Kia',
    model: 'Sorento SXL',
    year: 2018,
    price_contado: '$225,000',
    price_financiado: '$225,000',
    specs: ['Automática', 'Eléctrica', 'Asientos en piel', 'Cámara de reversa', '3 filas de asientos', '2 llaves', 'Factura de seguro', '4x4', '140,000 km']
  },
  {
    page: 42,
    category: "SUV'S",
    brand: 'Mitsubishi',
    model: 'L200',
    year: 2022,
    price_contado: '$335,000',
    price_financiado: '$345,000',
    specs: ['Transmisión manual', 'Eléctrica', 'Asientos en tela', '4x2', 'Factura de empresa', 'Único dueño', '1 llave', '130,000 km']
  },
  {
    page: 43,
    category: "SUV'S",
    brand: 'Peugeot',
    model: 'Partner Maxi',
    year: 2018,
    price_contado: '$215,000',
    price_financiado: '$225,000',
    specs: ['Factura de agencia', 'Un dueño', 'Transmisión manual (Std)', 'Eléctrica', 'A/C', 'Capacidad de carga 2 toneladas', '4 puertas', '193,000 km']
  },
  {
    page: 44,
    category: "SUV'S",
    brand: 'Peugeot',
    model: 'Partner Maxi Pack',
    year: 2021,
    price_contado: '$279,000',
    price_financiado: '$289,000',
    specs: ['Transmisión manual', 'A/C', 'Asientos en tela', 'Estéreo', 'Modos de manejo', 'Faros de niebla', 'Puerta lateral corrediza', 'Motor 1.6 Turbo Diesel', 'Capacidad de carga 950 kg', '120,000 km', 'Factura de seminuevos de agencia']
  },
  {
    page: 45,
    category: "SUV'S",
    brand: 'Chevrolet',
    model: 'Traverse LT',
    year: 2021,
    price_contado: '$505,000',
    price_financiado: '$515,000',
    specs: ['Automática', 'Eléctrica', 'Asientos en piel', '7 pasajeros', 'Cámara de reversa', 'Cámara 360°', 'Quemacocos', 'Techo panorámico', '72,000 km', 'Factura de agencia', 'Único dueño']
  },
  {
    page: 46,
    category: "SUV'S",
    brand: 'GMC',
    model: 'Terrain Denali',
    year: 2020,
    price_contado: '$379,000',
    price_financiado: '$389,000',
    specs: ['Automática', 'Eléctrica', 'Asientos en piel', 'Cámara de reversa', 'Quemacocos', 'Factura de agencia', '1 dueño', '137,000 km']
  },
  {
    page: 47,
    category: "SUV'S",
    brand: 'Jeep',
    model: 'Grand Cherokee Limited Lujo',
    year: 2015,
    price_contado: '$245,000',
    price_financiado: '$255,000',
    specs: ['Motor V6 3.6L', 'Automática', 'Eléctrica', 'Asientos en piel', 'Navegador', 'Quemacocos', 'Cámara de reversa', '132,000 km', 'Factura de seminuevos de agencia', '2 llaves 🔑']
  },
  {
    page: 48,
    category: "SUV'S",
    brand: 'Audi',
    model: 'Q5 Élite Quattro',
    year: 2013,
    price_contado: '$219,000',
    price_financiado: '$219,000',
    specs: ['100% mexicana', 'Llantas nuevas', 'Perfectas condiciones', '165,000 km', 'Techo panorámico', 'Botón de encendido', 'Factura de seminuevos']
  },
  {
    page: 49,
    category: "SUV'S",
    brand: 'Ford',
    model: 'EcoSport Titanium',
    year: 2019,
    price_contado: '$239,000',
    price_financiado: '$249,000',
    specs: ['Factura de agencia', 'Dos llaves', 'Llantas nuevas', 'Automática', 'Eléctrica', 'Cámara de reversa', 'Asientos en piel', 'Quemacocos', 'Pantalla', '76,000 km']
  },
  {
    page: 50,
    category: "SUV'S",
    brand: 'Nissan',
    model: 'Kicks Exclusive',
    year: 2018,
    price_contado: '$239,000',
    price_financiado: '$249,000',
    specs: ['Automática', 'Eléctrica', 'Asientos en piel', 'Cámara de reversa', 'Visión panorámica', 'Tacómetro digital', '103,000 km']
  },
  {
    page: 51,
    category: "SUV'S",
    brand: 'Mazda',
    model: 'CX-9 Signature',
    year: 2019,
    price_contado: '$420,000',
    price_financiado: '$430,000',
    specs: ['Automática', 'Eléctrica', 'Asientos en piel color vino', 'Cámara de reversa', '7 pasajeros', 'Quemacocos', 'AWD', '108,000 km', 'Todos sus servicios en la agencia']
  },

  // ==================== PICK UPS (Pages 53 to 65) ====================
  {
    page: 53,
    category: 'PICK UPS',
    brand: 'GMC',
    model: 'Sierra SLT 2500 HD',
    year: 2021,
    price_contado: '$1,050,000',
    price_financiado: '$1,060,000',
    specs: ['Importada por pedimento', 'Asientos en piel', 'Quemacocos', '8 birlos', '4x4', '104,000 millas', 'Cámara de reversa']
  },
  {
    page: 54,
    category: 'PICK UPS',
    brand: 'Chevrolet',
    model: 'Silverado Custom',
    year: 2022,
    price_contado: '$665,000',
    price_financiado: '$675,000',
    specs: ['Automática', 'Eléctrica', 'Asientos en tela', '4x4', '83,000 km', 'Factura de seminuevos', 'Motor 8 cil']
  },
  {
    page: 55,
    category: 'PICK UPS',
    brand: 'Chevrolet',
    model: 'Cheyenne RST',
    year: 2019,
    price_contado: '$665,000',
    price_financiado: '$675,000',
    specs: ['Automática', 'Eléctrica', '4x4', 'Asientos en tela', 'Cámara de reversa', 'Pantalla touch', 'Factura de seminuevos de agencia', '1 llave', '90,000 km']
  },
  {
    page: 56,
    category: 'PICK UPS',
    brand: 'Jeep',
    model: 'Rubicon Gladiator JT',
    year: 2023,
    price_contado: '$899,000',
    price_financiado: '$909,000',
    specs: ['33,000 km', 'Factura de agencia', 'Único dueño', '2 llaves', 'Motor V6 3.6L', '4x4', 'Automático', 'Eléctrico', 'Pantalla táctil', 'Controles al volante', 'Descapotable', 'Tapa en caja', 'Jalón', 'Cámara de reversa y cámara frontal', 'Llantas nuevas', 'Tomo tu unidad a cuenta']
  },
  {
    page: 57,
    category: 'PICK UPS',
    brand: 'Renault',
    model: 'Oroch Intense',
    year: 2019,
    price_contado: '$260,000',
    price_financiado: '$270,000',
    specs: ['Transmisión automática', 'Eléctrica', 'Asientos en tela', 'Quemacocos', 'Única dueña', '1 llave', '90,000 km', 'Factura de agencia']
  },
  {
    page: 58,
    category: 'PICK UPS',
    brand: 'RAM',
    model: '1500 Laramie Sport',
    year: 2020,
    price_contado: '$720,000',
    price_financiado: '$730,000',
    specs: ['1500 Mild Hybrid', '110,000 km', 'Asientos en piel / gamuza', '4x4', '8 cil 5.7L', 'Quemacocos', 'Cámara de reversa', 'Pantalla larga', 'Factura de seminuevos', 'Garantía hasta 2027', 'Llantas nuevas Michelin', 'Tapa batea', '2 llaves']
  },
  {
    page: 59,
    category: 'PICK UPS',
    brand: 'Chevrolet',
    model: 'Cheyenne LT',
    year: 2023,
    price_contado: '$825,000',
    price_financiado: '$835,000',
    specs: ['Automática', 'Eléctrica', 'Asientos en tela', '50,000 km', '4x4', 'Factura de agencia', '1 dueño', '2 llaves 🔑']
  },
  {
    page: 60,
    category: 'PICK UPS',
    brand: 'RAM',
    model: '1500 Big Horn',
    year: 2022,
    price_contado: '$755,000',
    price_financiado: '$765,000',
    specs: ['57,000 km', '4x4', 'Motor Pentastar eTorque Mild Hybrid V6 3.6L 305hp', 'Interiores en tela', 'Cámara de reversa', 'Todos los servicios en la agencia', 'Factura de empresa', 'Un dueño']
  },
  {
    page: 61,
    category: 'PICK UPS',
    brand: 'RAM',
    model: '1500 Limited',
    year: 2021,
    price_contado: '$860,000',
    price_financiado: '$870,000',
    specs: ['Automática', 'Eléctrica', 'Asientos en piel', 'Pantalla larga', 'Quemacocos', 'Cámara de reversa', '4x4', 'Suspensión de aire', '69,000 km']
  },
  {
    page: 62,
    category: 'PICK UPS',
    brand: 'RAM',
    model: '1500 Big Horn',
    year: 2022,
    price_contado: '$860,000',
    price_financiado: '$870,000',
    specs: ['57,000 km', '4x4', 'Motor Pentastar eTorque Mild Hybrid V6 3.6L 305hp', 'Interiores en tela', 'Cámara de reversa', 'Todos los servicios en la agencia', 'Factura de empresa', 'Un dueño']
  },
  {
    page: 63,
    category: 'PICK UPS',
    brand: 'Chevrolet',
    model: 'Cheyenne Clásica',
    year: 1990,
    price_contado: '$385,000',
    price_financiado: '$385,000',
    specs: ['Motor Vortec', 'Frenos de disco traseros', 'Diferencial positivo', 'Repro en la computadora', 'Headers', 'Llantas nuevas', 'Rines 22', 'Aire acondicionado', 'Interior impecable', 'Equipo de sonido JL todo clase D competition', 'Pantalla Alpine']
  },
  {
    page: 64,
    category: 'PICK UPS',
    brand: 'Ford',
    model: 'Lobo Raptor R',
    year: 2025,
    price_contado: '$2,580,000',
    price_financiado: '$2,590,000',
    specs: ['20,000 km', 'Factura de seminuevos', 'Asientos en Alcántara', 'Todos sus servicios en la agencia', '4x4', 'Motor V8 5.2L Supercharged', 'Filtro de alto flujo', 'Polea de súper cargador', 'Banda de accesorios uso rudo', 'Repro en motor y transmisión', 'Tapa en caja sólida', 'Tubería de acero inoxidable']
  },
  {
    page: 65,
    category: 'PICK UPS',
    brand: 'Volkswagen',
    model: 'Amarok Highline',
    year: 2015,
    price_contado: '$249,000',
    price_financiado: '$259,000',
    specs: ['Factura de seminuevos', '216,000 km', 'Asientos en piel', 'Automática', '4x4']
  },

  // ==================== DEPORTIVOS (Pages 67 to 69) ====================
  {
    page: 67,
    category: 'DEPORTIVOS',
    brand: 'Mercedes-Benz',
    model: 'S500 Wald Black',
    year: 2018,
    price_contado: '$1,100,000',
    price_financiado: '$1,100,000',
    specs: ['Full catback', 'Intakes', 'Repro', 'Bodykit WALD', '55,000 km', 'Techo panorámico', 'Mexicano 100%', 'Motor V8 biturbo 4.6L']
  },
  {
    page: 68,
    category: 'DEPORTIVOS',
    brand: 'Audi',
    model: 'RS5 Sportback Quattro',
    year: 2021,
    price_contado: '$1,060,000',
    price_financiado: '$1,070,000',
    specs: ['4 puertas', 'Automático', 'Eléctrico', 'Asientos en piel', 'Cámara de reversa', 'Quemacocos', 'Transmisión Quattro', '1 llave 🔑', '50,000 km', 'Motor V6 2.9L bi-turbo', 'Factura de seminuevos Audi']
  },
  {
    page: 69,
    category: 'DEPORTIVOS',
    brand: 'McLaren',
    model: '540C V8 Twin Turbo',
    year: 2017,
    price_contado: '$1,350,000',
    price_financiado: '$1,350,000',
    specs: ['Asientos en Alcántara', '21,000 km', 'Motor V8 3.8L biturbo', 'Transmisión secuencial de doble embrague', 'Chasis monocasco de fibra de carbono']
  }
];

// Helper to check photos
function buildVehicleObject(item) {
  const p = item.page;
  const coverPath = `assets/cars/page_${p}_img_2.jpeg`;
  const photos = [];
  
  [2, 3, 4, 5].forEach(i => {
    const photoPath = `assets/cars/page_${p}_img_${i}.jpeg`;
    if (fs.existsSync(path.join(__dirname, '..', photoPath))) {
      photos.push(photoPath);
    }
  });

  return {
    id: `autohaus-p${p}`,
    page: p,
    brand: item.brand,
    model: item.model,
    year: item.year,
    price: item.price_contado,
    price_contado: item.price_contado,
    price_financiado: item.price_financiado,
    category: item.category,
    cover_photo: coverPath,
    real_photos: photos.length > 0 ? photos : [coverPath],
    specs: item.specs,
    status: 'Disponible'
  };
}

const finalVehicles = rawCatalog.map(buildVehicleObject);

// Check if all images exist
let missingImages = 0;
finalVehicles.forEach(v => {
  if (!fs.existsSync(path.join(__dirname, '..', v.cover_photo))) {
    console.error(`MISSING COVER: ${v.cover_photo} for ${v.brand} ${v.model}`);
    missingImages++;
  }
});

console.log(`Verified ${finalVehicles.length} vehicles. Missing cover images: ${missingImages}`);

// Write to catalog.json
const catalogPath = path.join(__dirname, '..', 'assets', 'data', 'catalog.json');
fs.writeFileSync(catalogPath, JSON.stringify(finalVehicles, null, 2), 'utf8');
console.log(`Saved catalog.json (${finalVehicles.length} vehicles).`);

// Write to scripts/data.js as fallback/initial array
const dataJsPath = path.join(__dirname, 'data.js');
const jsContent = `// Auto-generated 100% matched catalog from official Heyzine 84edf79c22.pdf\nconst initialVehicles = ${JSON.stringify(finalVehicles, null, 2)};\n\nif (typeof module !== 'undefined' && module.exports) {\n  module.exports = { initialVehicles };\n}\n`;
fs.writeFileSync(dataJsPath, jsContent, 'utf8');
console.log(`Saved scripts/data.js.`);
