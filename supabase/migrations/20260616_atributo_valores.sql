-- Tabla de valores predefinidos por tipo de atributo (Color, Talle, etc.)
CREATE TABLE IF NOT EXISTS atributo_valores (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  atributo_tipo_id bigint NOT NULL REFERENCES atributo_tipos(id) ON DELETE CASCADE,
  valor            text NOT NULL,
  activo           boolean NOT NULL DEFAULT true,
  orden            int NOT NULL DEFAULT 0,
  UNIQUE (atributo_tipo_id, valor)
);

CREATE INDEX IF NOT EXISTS atributo_valores_tipo_idx ON atributo_valores (atributo_tipo_id);

-- Seed: colores predefinidos
INSERT INTO atributo_valores (atributo_tipo_id, valor, orden)
SELECT id, v.valor, v.orden FROM atributo_tipos
CROSS JOIN (VALUES
  ('Negro',0),('Blanco',1),('Gris',2),('Rojo',3),('Azul',4),
  ('Verde',5),('Amarillo',6),('Rosa',7),('Naranja',8),('Violeta',9),
  ('Marrón',10),('Beige',11),('Celeste',12),('Bordó',13)
) AS v(valor,orden) WHERE nombre = 'Color'
ON CONFLICT DO NOTHING;

-- Seed: talles predefinidos
INSERT INTO atributo_valores (atributo_tipo_id, valor, orden)
SELECT id, v.valor, v.orden FROM atributo_tipos
CROSS JOIN (VALUES
  ('XS',0),('S',1),('M',2),('L',3),('XL',4),('XXL',5),('XXXL',6),
  ('36',7),('37',8),('38',9),('39',10),('40',11),('41',12),('42',13),('43',14),('44',15),('45',16),
  ('1',17),('2',18),('3',19),('4',20),('6',21),('8',22),('10',23),('12',24),('14',25),('16',26)
) AS v(valor,orden) WHERE nombre = 'Talle'
ON CONFLICT DO NOTHING;

-- Seed: tamaños predefinidos
INSERT INTO atributo_valores (atributo_tipo_id, valor, orden)
SELECT id, v.valor, v.orden FROM atributo_tipos
CROSS JOIN (VALUES
  ('Pequeño',0),('Mediano',1),('Grande',2),('Extra Grande',3)
) AS v(valor,orden) WHERE nombre = 'Tamaño'
ON CONFLICT DO NOTHING;

-- Seed: materiales predefinidos
INSERT INTO atributo_valores (atributo_tipo_id, valor, orden)
SELECT id, v.valor, v.orden FROM atributo_tipos
CROSS JOIN (VALUES
  ('Algodón',0),('Poliéster',1),('Cuero',2),('Tela',3),('Plástico',4),('Metal',5),('Madera',6)
) AS v(valor,orden) WHERE nombre = 'Material'
ON CONFLICT DO NOTHING;
