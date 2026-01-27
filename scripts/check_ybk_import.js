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
    console.log('client:', client);

    const { data: brand, error: bErr } = await supabase
      .from('brand')
      .select('id, code, name_ko, status')
      .eq('customer_master_id', client.id)
      .eq('code', 'YBK')
      .single();
    if (bErr) throw bErr;
    console.log('brand:', brand);

    const { count: productCount, error: pErr } = await supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', brand.id);
    if (pErr) throw pErr;
    console.log('products:', productCount);

    const { count: barcodeCount, error: bcErr } = await supabase
      .from('product_barcodes')
      .select('id', { count: 'exact', head: true });
    if (bcErr) throw bcErr;
    console.log('product_barcodes total:', barcodeCount);
  } catch (err) {
    logErr('check failed:', err);
    process.exit(1);
  }
})();
