const { createClient } = require('@supabase/supabase-js');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const logErr = (label, err) => {
  try { console.error(label, JSON.stringify(err, null, 2)); } catch { console.error(label, err); }
};
(async () => {
  try {
    const { data: client, error: cErr } = await supabase
      .from('customer_master')
      .select('id, code, name, status')
      .eq('code', 'YBK')
      .single();
    if (cErr) throw cErr;

    const { data: brand, error: bErr } = await supabase
      .from('brand')
      .select('id, code, name_ko, status')
      .eq('customer_master_id', client.id)
      .eq('code', 'YBK')
      .single();
    if (bErr) throw bErr;

    const { data: sampleProducts, error: pErr } = await supabase
      .from('products')
      .select('id, name, sku, barcode, category, brand_id')
      .eq('brand_id', brand.id)
      .limit(5);
    if (pErr) throw pErr;

    const { data: sampleBarcodes, error: bcErr } = await supabase
      .from('product_barcodes')
      .select('product_id, barcode, barcode_type, is_primary')
      .eq('product_id', sampleProducts?.[0]?.id)
      .limit(3);
    if (bcErr) throw bcErr;

    console.log('client:', client);
    console.log('brand:', brand);
    console.log('sample products:', sampleProducts);
    console.log('sample barcodes for first product:', sampleBarcodes);

    if (sampleBarcodes?.[0]?.barcode) {
      const barcode = sampleBarcodes[0].barcode;
      const { data: barcodeHit, error: bhErr } = await supabase
        .from('product_barcodes')
        .select('product_id, barcode, barcode_type, is_primary')
        .eq('barcode', barcode)
        .single();
      if (bhErr) throw bhErr;

      const { data: barcodeProduct, error: bpErr } = await supabase
        .from('products')
        .select('id, sku, name, barcode')
        .eq('id', barcodeHit.product_id)
        .single();
      if (bpErr) throw bpErr;

      console.log('barcode lookup:', { barcode, product: barcodeProduct });
    }
  } catch (err) {
    logErr('check failed:', err);
    process.exit(1);
  }
})();
