-- Seed baseline WMS glossary terms for CS quick translate.
-- Context-sensitive terms such as 唛头 are handled in the translation prompt,
-- so only exact one-to-one mappings are inserted here.

insert into public.cs_glossary (term_ko, term_zh, note, priority, active)
select '적치', '上架', 'WMS 용어 - 로케이션 적재/적치', 10, true
where not exists (
  select 1
  from public.cs_glossary
  where term_ko = '적치'
    and term_zh = '上架'
);

insert into public.cs_glossary (term_ko, term_zh, note, priority, active)
select '입고건', '入库单', 'WMS 용어 - 입고 관련 문서/건', 10, true
where not exists (
  select 1
  from public.cs_glossary
  where term_ko = '입고건'
    and term_zh = '入库单'
);

insert into public.cs_glossary (term_ko, term_zh, note, priority, active)
select '패킹리스트', '箱单', '물류 문서 용어', 9, true
where not exists (
  select 1
  from public.cs_glossary
  where term_ko = '패킹리스트'
    and term_zh = '箱单'
);

insert into public.cs_glossary (term_ko, term_zh, note, priority, active)
select '로케이션', '库位', 'WMS 용어 - 보관 위치', 9, true
where not exists (
  select 1
  from public.cs_glossary
  where term_ko = '로케이션'
    and term_zh = '库位'
);
