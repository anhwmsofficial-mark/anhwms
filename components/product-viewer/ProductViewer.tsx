'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import './product-viewer.css';

type ProductItem = {
  id: string;
  key?: string | null;
  excel_name?: string | null;
  excel_mgmt?: string | null;
  cat?: string | null;
  images?: string[] | null;
  thumb?: string | null;
};

const ASSET_BASE = '/product';
const MANIFEST_URL = `${ASSET_BASE}/manifest.json`;

function assetUrl(rel: string | null | undefined) {
  if (!rel) return '';
  if (/^https?:\/\//i.test(rel) || rel.startsWith('/')) return rel;
  return `${ASSET_BASE}/${rel.replace(/^\.\//, '')}`;
}

function productLabel(product: ProductItem) {
  return product.excel_name || product.key || product.id;
}

function readHashId() {
  if (typeof window === 'undefined') return '';
  return (window.location.hash || '').replace(/^#/, '');
}

export default function ProductViewer() {
  const [items, setItems] = useState<ProductItem[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('전체');
  const [selectedId, setSelectedId] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark' | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(MANIFEST_URL).then((response) => {
        if (!response.ok) throw new Error('manifest fetch failed');
        return response.json() as Promise<ProductItem[]>;
      }),
      fetch('/api/product-showcase')
        .then(async (response) => {
          if (!response.ok) return [] as ProductItem[];
          const body = await response.json();
          return (body?.ok && Array.isArray(body.data) ? body.data : []) as ProductItem[];
        })
        .catch(() => [] as ProductItem[]),
    ])
      .then(([manifest, managed]) => {
        if (cancelled) return;
        const merged = new Map<string, ProductItem>();
        (Array.isArray(manifest) ? manifest : []).forEach((product) => merged.set(product.id, product));
        managed.forEach((product) => merged.set(product.id, product));
        const next = Array.from(merged.values())
          .filter((product) => Array.isArray(product.images) && product.images.length > 0)
          .sort((a, b) => productLabel(a).localeCompare(productLabel(b), 'ko'));
        setItems(next);
        setLoadState('ready');
      })
      .catch(() => {
        if (!cancelled) setLoadState('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const syncHash = () => setSelectedId(readHashId());
    syncHash();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 1800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const selected = useMemo(
    () => items.find((product) => product.id === selectedId) || null,
    [items, selectedId]
  );

  const categories = useMemo(() => {
    const next = ['전체'];
    items.forEach((product) => {
      const cat = product.cat || '미분류';
      if (!next.includes(cat)) next.push(cat);
    });
    return next;
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((product) => {
      const cat = product.cat || '미분류';
      const haystack = `${productLabel(product)} ${product.excel_mgmt || ''} ${product.id}`.toLowerCase();
      return (category === '전체' || cat === category) && (!q || haystack.includes(q));
    });
  }, [items, query, category]);

  const crumb = selected ? productLabel(selected) : '장기부진재고 상세페이지';

  useEffect(() => {
    const previous = document.title;
    document.title = selected ? `${productLabel(selected)} | ANH WMS` : 'ANH WMS 상세페이지';
    return () => {
      document.title = previous;
    };
  }, [selected]);

  useEffect(() => {
    if (loadState === 'ready') window.scrollTo(0, 0);
  }, [selectedId, loadState]);

  const copyLink = useCallback(async (product: ProductItem) => {
    const url = `${window.location.href.split('#')[0]}#${product.id}`;
    const ok = () => setToast('링크를 복사했어요');
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        ok();
        return;
      }
    } catch {
      // fallback below
    }
    const textarea = document.createElement('textarea');
    textarea.value = url;
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      ok();
    } catch {
      setToast(url);
    }
    textarea.remove();
  }, []);

  const toggleTheme = () => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = theme === 'dark' || (theme == null && prefersDark);
    setTheme(isDark ? 'light' : 'dark');
  };

  return (
    <div className="product-viewer" data-theme={theme ?? undefined}>
      <header className="top">
        <div className="wrap" style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
          <a className="brand" href="#">
            ANH WMS
          </a>
          <span className="crumb grow">{crumb}</span>
          <button className="btn" type="button" aria-label="화면 모드 바꾸기" onClick={toggleTheme}>
            화면 모드
          </button>
        </div>
      </header>

      <main className="wrap">
        {loadState === 'loading' && <div className="empty">불러오는 중…</div>}
        {loadState === 'error' && (
          <div className="empty">상품 목록을 불러오지 못했습니다. 새로고침해 주세요.</div>
        )}
        {loadState === 'ready' && selected && (
          <div className="detail">
            <div className="dhead">
              <span className="sub">
                {selected.cat || ''} · {selected.id}
              </span>
              <h1>{productLabel(selected)}</h1>
            </div>
            <div className="actions">
              <a className="btn" href="#">
                ← 목록
              </a>
              <button className="btn primary" type="button" onClick={() => copyLink(selected)}>
                링크 복사
              </button>
            </div>
            <div className="pages">
              {(selected.images || []).map((src, index) => (
                // Product images can come from runtime-configured Storage domains.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={`${selected.id}-${src}-${index}`}
                  loading="lazy"
                  decoding="async"
                  src={assetUrl(src)}
                  alt={`${productLabel(selected)} ${index + 1}`}
                />
              ))}
            </div>
          </div>
        )}
        {loadState === 'ready' && !selected && (
          <>
            <div className="tools">
              <input
                type="search"
                placeholder="상품명 검색"
                aria-label="상품명 검색"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <div className="cats">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className="chip"
                  aria-pressed={cat === category}
                  onClick={() => setCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="count">{filtered.length}개 상품</div>
            {filtered.length === 0 ? (
              <div className="empty">검색 결과가 없습니다.</div>
            ) : (
              <div className="grid">
                {filtered.map((product) => (
                  <a key={product.id} className="card" href={`#${product.id}`}>
                    <div className="thumb">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img loading="lazy" decoding="async" src={assetUrl(product.thumb)} alt="" />
                    </div>
                    <div className="meta">
                      <span className="name">{productLabel(product)}</span>
                      <span className="sub">
                        {product.id} · {(product.images || []).length}컷
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </>
        )}
      </main>
      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}
