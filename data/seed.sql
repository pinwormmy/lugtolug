INSERT OR IGNORE INTO watches
(id, brand, model, reference, brand_slug, model_slug, reference_slug, search_text, lug_to_lug_mm, diameter_mm, thickness_mm, lug_width_mm, confidence, status)
VALUES
(1, 'Rolex', 'Submariner Date', '126610LN', 'rolex', 'submariner-date', '126610ln', 'rolex submariner date 126610ln', 47.6, 41, 12.5, 21, 'medium', 'approved'),
(2, 'Omega', 'Speedmaster Professional Moonwatch', '310.30.42.50.01.002', 'omega', 'speedmaster-professional-moonwatch', '310-30-42-50-01-002', 'omega speedmaster professional moonwatch 310 30 42 50 01 002', 47.5, 42, 13.2, 20, 'medium', 'approved'),
(3, 'Seiko', '5 Sports', 'SRPD55', 'seiko', '5-sports', 'srpd55', 'seiko 5 sports srpd55', 46, 42.5, 13.4, 22, 'medium', 'approved'),
(4, 'Tudor', 'Black Bay 58', 'M79030N-0001', 'tudor', 'black-bay-58', 'm79030n-0001', 'tudor black bay 58 m79030n 0001', 47.8, 39, 11.9, 20, 'medium', 'approved'),
(5, 'Cartier', 'Santos de Cartier Medium', 'WSSA0029', 'cartier', 'santos-de-cartier-medium', 'wssa0029', 'cartier santos de cartier medium wssa0029', 41.9, 35.1, 8.83, 18, 'medium', 'approved');

INSERT OR IGNORE INTO watch_sources (id, watch_id, source_url, note)
VALUES
(1, 1, 'https://www.rolex.com/watches/submariner/m126610ln-0001', 'Manufacturer model reference; some dimensions are community-measured.'),
(2, 2, 'https://www.omegawatches.com/watch-omega-speedmaster-moonwatch-professional-co-axial-master-chronometer-chronograph-42-mm-31030425001002', 'Manufacturer page plus community lug-to-lug measurements.'),
(3, 3, 'https://seikousa.com/products/srpd55', 'Manufacturer page plus retailer measurements.'),
(4, 4, 'https://www.tudorwatch.com/en/watches/black-bay-58/m79030n-0001', 'Manufacturer reference; lug-to-lug is commonly measured by reviewers.'),
(5, 5, 'https://www.cartier.com/en-us/watches/collections/santos-de-cartier/santos-de-cartier-watch-CRWSSA0029.html', 'Manufacturer dimensions; lug-to-lug varies by measurement method.');
