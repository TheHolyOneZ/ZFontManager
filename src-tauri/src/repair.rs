use std::collections::BTreeMap;

const KEPT: [&[u8; 4]; 8] = [
    b"CFF ", b"CFF2", b"cvt ", b"fpgm", b"gasp", b"glyf", b"kern", b"prep",
];

type Tag = [u8; 4];

fn u16_at(data: &[u8], at: usize) -> Option<u16> {
    let b = data.get(at..at + 2)?;
    Some(u16::from_be_bytes([b[0], b[1]]))
}

fn i16_at(data: &[u8], at: usize) -> Option<i16> {
    u16_at(data, at).map(|v| v as i16)
}

fn u32_at(data: &[u8], at: usize) -> Option<u32> {
    let b = data.get(at..at + 4)?;
    Some(u32::from_be_bytes([b[0], b[1], b[2], b[3]]))
}

fn put_u16(data: &mut [u8], at: usize, value: u16) {
    data[at..at + 2].copy_from_slice(&value.to_be_bytes());
}

fn put_i16(data: &mut [u8], at: usize, value: i16) {
    put_u16(data, at, value as u16);
}

fn put_u32(data: &mut [u8], at: usize, value: u32) {
    data[at..at + 4].copy_from_slice(&value.to_be_bytes());
}

fn read_tables(data: &[u8], index: u32) -> Option<BTreeMap<Tag, &[u8]>> {
    let base = if data.get(0..4)? == b"ttcf" {
        u32_at(data, 12 + 4 * index as usize)? as usize
    } else {
        0
    };
    let count = u16_at(data, base + 4)? as usize;
    let mut tables = BTreeMap::new();
    for i in 0..count {
        let entry = base + 12 + 16 * i;
        let Some(tag) = data.get(entry..entry + 4) else {
            break;
        };
        let (Some(offset), Some(length)) = (u32_at(data, entry + 8), u32_at(data, entry + 12)) else {
            break;
        };
        let offset = offset as usize;
        if offset >= data.len() {
            continue;
        }
        let end = offset.saturating_add(length as usize).min(data.len());
        tables.insert([tag[0], tag[1], tag[2], tag[3]], &data[offset..end]);
    }
    Some(tables)
}

fn fix_head(raw: &[u8], loca_format: i16) -> Option<Vec<u8>> {
    let mut head = raw.get(..54)?.to_vec();
    put_u32(&mut head, 0, 0x0001_0000);
    put_u32(&mut head, 8, 0);
    put_u32(&mut head, 12, 0x5F0F_3CF5);
    let upem = u16_at(&head, 18)?;
    if !(16..=16384).contains(&upem) {
        put_u16(&mut head, 18, 1000);
    }
    let (x_min, y_min, x_max, y_max) = (
        i16_at(&head, 36)?,
        i16_at(&head, 38)?,
        i16_at(&head, 40)?,
        i16_at(&head, 42)?,
    );
    put_i16(&mut head, 36, x_min.min(x_max));
    put_i16(&mut head, 38, y_min.min(y_max));
    put_i16(&mut head, 40, x_min.max(x_max));
    put_i16(&mut head, 42, y_min.max(y_max));
    put_i16(&mut head, 50, loca_format);
    put_i16(&mut head, 52, 0);
    Some(head)
}

fn fix_maxp(raw: &[u8], outlines_in_glyf: bool, glyphs: u16) -> Vec<u8> {
    if !outlines_in_glyf {
        let mut maxp = vec![0u8; 6];
        put_u32(&mut maxp, 0, 0x0000_5000);
        put_u16(&mut maxp, 4, glyphs);
        return maxp;
    }
    let mut maxp = vec![0u8; 32];
    let copied = raw.len().min(32);
    maxp[..copied].copy_from_slice(&raw[..copied]);
    put_u32(&mut maxp, 0, 0x0001_0000);
    put_u16(&mut maxp, 4, glyphs);
    if u16_at(&maxp, 14).unwrap_or(0) == 0 {
        put_u16(&mut maxp, 14, 1);
    }
    maxp
}

fn fix_hhea(raw: &[u8], metrics: u16) -> Option<Vec<u8>> {
    let mut hhea = raw.get(..36)?.to_vec();
    put_u32(&mut hhea, 0, 0x0001_0000);
    hhea[24..32].fill(0);
    put_i16(&mut hhea, 32, 0);
    put_u16(&mut hhea, 34, metrics);
    Some(hhea)
}

fn fix_hmtx(raw: &[u8], metrics: usize, glyphs: usize, fallback_advance: u16) -> Vec<u8> {
    let needed = 4 * metrics + 2 * (glyphs - metrics);
    let mut hmtx = raw[..raw.len().min(needed)].to_vec();
    hmtx.resize(needed, 0);
    if raw.len() < 4 {
        put_u16(&mut hmtx, 0, fallback_advance);
    }
    hmtx
}

fn fix_loca(raw: &[u8], long: bool, glyphs: usize, glyf_len: usize) -> Vec<u8> {
    let read = |i: usize| -> Option<usize> {
        if long {
            u32_at(raw, 4 * i).map(|v| v as usize)
        } else {
            u16_at(raw, 2 * i).map(|v| v as usize * 2)
        }
    };
    let mut out = Vec::with_capacity((glyphs + 1) * if long { 4 } else { 2 });
    let mut previous = 0usize;
    for i in 0..=glyphs {
        let offset = match read(i) {
            Some(v) if v >= previous && v <= glyf_len => v,
            _ => previous,
        };
        previous = offset;
        if long {
            out.extend_from_slice(&(offset as u32).to_be_bytes());
        } else {
            out.extend_from_slice(&((offset / 2) as u16).to_be_bytes());
        }
    }
    out
}

fn collect_mappings(raw: &[u8]) -> BTreeMap<u32, u16> {
    use ttf_parser::PlatformId;

    let mut pairs = BTreeMap::new();
    let Some(cmap) = ttf_parser::cmap::Table::parse(raw) else {
        return pairs;
    };
    for sub in cmap.subtables {
        let symbol = sub.platform_id == PlatformId::Windows && sub.encoding_id == 0;
        let macintosh = sub.platform_id == PlatformId::Macintosh;
        if !sub.is_unicode() && !symbol && !macintosh {
            continue;
        }
        let mut codepoints = Vec::new();
        sub.codepoints(|cp| codepoints.push(cp));
        for cp in codepoints {
            let Some(glyph) = sub.glyph_index(cp).filter(|g| g.0 != 0) else {
                continue;
            };
            if macintosh {
                if cp < 0x80 {
                    pairs.entry(cp).or_insert(glyph.0);
                }
                continue;
            }
            pairs.entry(cp).or_insert(glyph.0);
            if symbol && (0xF000..=0xF0FF).contains(&cp) {
                pairs.entry(cp - 0xF000).or_insert(glyph.0);
            }
        }
    }
    pairs
}

fn build_cmap(pairs: &BTreeMap<u32, u16>, glyphs: u16) -> Vec<u8> {
    let mut groups: Vec<(u32, u32, u32)> = Vec::new();
    for (&cp, &glyph) in pairs {
        if glyph >= glyphs {
            continue;
        }
        let glyph = u32::from(glyph);
        match groups.last_mut() {
            Some((start, end, first)) if cp == *end + 1 && glyph == *first + (cp - *start) => {
                *end = cp;
            }
            _ => groups.push((cp, cp, glyph)),
        }
    }
    let mut out = Vec::with_capacity(28 + 12 * groups.len());
    out.extend_from_slice(&0u16.to_be_bytes());
    out.extend_from_slice(&1u16.to_be_bytes());
    out.extend_from_slice(&3u16.to_be_bytes());
    out.extend_from_slice(&10u16.to_be_bytes());
    out.extend_from_slice(&12u32.to_be_bytes());
    out.extend_from_slice(&12u16.to_be_bytes());
    out.extend_from_slice(&0u16.to_be_bytes());
    out.extend_from_slice(&(16 + 12 * groups.len() as u32).to_be_bytes());
    out.extend_from_slice(&0u32.to_be_bytes());
    out.extend_from_slice(&(groups.len() as u32).to_be_bytes());
    for (start, end, glyph) in groups {
        out.extend_from_slice(&start.to_be_bytes());
        out.extend_from_slice(&end.to_be_bytes());
        out.extend_from_slice(&glyph.to_be_bytes());
    }
    out
}

fn build_post(raw: Option<&&[u8]>) -> Vec<u8> {
    let mut post = vec![0u8; 32];
    if let Some(raw) = raw {
        let copied = raw.len().min(16);
        post[..copied].copy_from_slice(&raw[..copied]);
    }
    put_u32(&mut post, 0, 0x0003_0000);
    post
}

fn build_name() -> Vec<u8> {
    const RECORDS: [(u16, &str); 4] = [
        (1, "ZFontManager Preview"),
        (2, "Regular"),
        (4, "ZFontManager Preview"),
        (6, "ZFontManager-Preview"),
    ];
    let encoded: Vec<(u16, Vec<u8>)> = RECORDS
        .iter()
        .map(|(id, text)| (*id, text.encode_utf16().flat_map(u16::to_be_bytes).collect()))
        .collect();
    let storage_at = 6 + 12 * encoded.len();
    let mut out = Vec::new();
    out.extend_from_slice(&0u16.to_be_bytes());
    out.extend_from_slice(&(encoded.len() as u16).to_be_bytes());
    out.extend_from_slice(&(storage_at as u16).to_be_bytes());
    let mut offset = 0u16;
    for (id, bytes) in &encoded {
        for field in [3u16, 1, 0x0409, *id, bytes.len() as u16, offset] {
            out.extend_from_slice(&field.to_be_bytes());
        }
        offset += bytes.len() as u16;
    }
    for (_, bytes) in &encoded {
        out.extend_from_slice(bytes);
    }
    out
}

fn build_os2(raw: Option<&&[u8]>, head: &[u8], hhea: &[u8]) -> Option<Vec<u8>> {
    let mut os2 = vec![0u8; 96];
    let copied = raw.map_or(0, |r| r.len().min(78));
    if let Some(raw) = raw {
        os2[..copied].copy_from_slice(&raw[..copied]);
    }
    put_u16(&mut os2, 0, 3);
    if !(1..=1000).contains(&u16_at(&os2, 4)?) {
        put_u16(&mut os2, 4, 400);
    }
    if !(1..=9).contains(&u16_at(&os2, 6)?) {
        put_u16(&mut os2, 6, 5);
    }
    if copied == 78 {
        return Some(os2);
    }
    let ascender = i16_at(hhea, 4)?;
    let descender = i16_at(hhea, 6)?;
    let line_gap = i16_at(hhea, 8)?;
    let y_min = i16_at(head, 38)?;
    let y_max = i16_at(head, 42)?;
    put_i16(&mut os2, 68, ascender);
    put_i16(&mut os2, 70, descender);
    put_i16(&mut os2, 72, line_gap);
    put_u16(&mut os2, 74, ascender.max(y_max).max(0) as u16);
    put_u16(&mut os2, 76, descender.min(y_min).min(0).unsigned_abs());
    Some(os2)
}

fn checksum(table: &[u8]) -> u32 {
    table.chunks(4).fold(0u32, |sum, chunk| {
        let mut word = [0u8; 4];
        word[..chunk.len()].copy_from_slice(chunk);
        sum.wrapping_add(u32::from_be_bytes(word))
    })
}

fn assemble(tables: BTreeMap<Tag, Vec<u8>>, flavour: [u8; 4]) -> Vec<u8> {
    let count = tables.len() as u16;
    let selector = 15 - count.leading_zeros() as u16;
    let range = (1u16 << selector) * 16;
    let mut out = Vec::new();
    out.extend_from_slice(&flavour);
    for field in [count, range, selector, count * 16 - range] {
        out.extend_from_slice(&field.to_be_bytes());
    }
    let mut offset = 12 + 16 * tables.len();
    let mut head_at = None;
    for (tag, table) in &tables {
        out.extend_from_slice(tag);
        out.extend_from_slice(&checksum(table).to_be_bytes());
        out.extend_from_slice(&(offset as u32).to_be_bytes());
        out.extend_from_slice(&(table.len() as u32).to_be_bytes());
        if tag == b"head" {
            head_at = Some(offset);
        }
        offset += (table.len() + 3) & !3;
    }
    for table in tables.values() {
        out.extend_from_slice(table);
        out.resize((out.len() + 3) & !3, 0);
    }
    if let Some(at) = head_at {
        let adjustment = 0xB1B0_AFBAu32.wrapping_sub(checksum(&out));
        put_u32(&mut out, at + 8, adjustment);
    }
    out
}

pub fn rebuild(data: &[u8], index: u32) -> Option<Vec<u8>> {
    let raw = read_tables(data, index)?;
    let glyf = raw.get(b"glyf");
    let outlines_in_glyf = glyf.is_some();
    if !outlines_in_glyf && !raw.contains_key(b"CFF ") && !raw.contains_key(b"CFF2") {
        return None;
    }

    let raw_head = raw.get(b"head")?;
    let raw_hhea = raw.get(b"hhea")?;
    let raw_hmtx = raw.get(b"hmtx").copied().unwrap_or(&[]);
    let glyphs = u16_at(raw.get(b"maxp")?, 4).filter(|g| *g > 0)?;
    let count = usize::from(glyphs);

    let declared = i16_at(raw_head, 50)?;
    let loca_raw = raw.get(b"loca").copied().unwrap_or(&[]);
    let long_loca = match declared {
        0 => false,
        1 => true,
        _ => loca_raw.len() >= 4 * (count + 1),
    };

    let metrics = u16_at(raw_hhea, 34)?
        .min(glyphs)
        .min((raw_hmtx.len() / 4).min(usize::from(u16::MAX)) as u16)
        .max(1);

    let head = fix_head(raw_head, i16::from(long_loca))?;
    let hhea = fix_hhea(raw_hhea, metrics)?;
    let pairs = raw.get(b"cmap").map(|c| collect_mappings(c)).unwrap_or_default();
    if pairs.is_empty() {
        return None;
    }

    let mut out: BTreeMap<Tag, Vec<u8>> = BTreeMap::new();
    for tag in KEPT {
        if let Some(table) = raw.get(tag) {
            out.insert(*tag, table.to_vec());
        }
    }
    if raw.contains_key(b"CFF2") {
        for tag in [b"avar", b"fvar"] {
            if let Some(table) = raw.get(tag) {
                out.insert(*tag, table.to_vec());
            }
        }
    }
    if let Some(glyf) = glyf {
        out.insert(*b"loca", fix_loca(loca_raw, long_loca, count, glyf.len()));
    }
    out.insert(*b"OS/2", build_os2(raw.get(b"OS/2"), &head, &hhea)?);
    out.insert(*b"cmap", build_cmap(&pairs, glyphs));
    out.insert(*b"head", head);
    out.insert(*b"hhea", hhea);
    let widest = u16_at(raw_hhea, 10).filter(|w| *w > 0).unwrap_or(1000);
    out.insert(*b"hmtx", fix_hmtx(raw_hmtx, usize::from(metrics), count, widest));
    out.insert(*b"maxp", fix_maxp(raw.get(b"maxp")?, outlines_in_glyf, glyphs));
    out.insert(*b"name", build_name());
    out.insert(*b"post", build_post(raw.get(b"post")));

    let flavour = if outlines_in_glyf { [0, 1, 0, 0] } else { *b"OTTO" };
    Some(assemble(out, flavour))
}

#[cfg(all(test, target_os = "linux"))]
mod tests {
    use super::*;

    fn has_outlines_and_text(data: &[u8]) -> bool {
        let Some(tables) = read_tables(data, 0) else {
            return false;
        };
        [b"glyf", b"OS/2", b"post"].iter().all(|tag| tables.contains_key(*tag))
            && ttf_parser::Face::parse(data, 0).is_ok_and(|face| face.glyph_index('A').is_some())
    }

    fn system_ttf() -> Option<Vec<u8>> {
        walkdir::WalkDir::new("/usr/share/fonts")
            .into_iter()
            .filter_map(Result::ok)
            .filter(|e| e.path().extension().is_some_and(|x| x.eq_ignore_ascii_case("ttf")))
            .filter_map(|e| std::fs::read(e.path()).ok())
            .find(|data| has_outlines_and_text(data))
    }

    fn pack(tables: BTreeMap<Tag, Vec<u8>>) -> Vec<u8> {
        assemble(tables, [0, 1, 0, 0])
    }

    fn owned(data: &[u8]) -> BTreeMap<Tag, Vec<u8>> {
        read_tables(data, 0)
            .unwrap()
            .into_iter()
            .map(|(tag, table)| (tag, table.to_vec()))
            .collect()
    }

    #[test]
    fn a_rebuilt_font_keeps_its_glyphs_and_mappings() {
        let Some(data) = system_ttf() else { return };
        let before = ttf_parser::Face::parse(&data, 0).unwrap();
        let fixed = rebuild(&data, 0).unwrap();
        let after = ttf_parser::Face::parse(&fixed, 0).unwrap();
        assert_eq!(before.number_of_glyphs(), after.number_of_glyphs());
        assert_eq!(before.units_per_em(), after.units_per_em());
        let glyph = before.glyph_index('A');
        assert!(glyph.is_some());
        assert_eq!(glyph, after.glyph_index('A'));
    }

    #[test]
    fn old_style_tables_are_replaced() {
        let Some(data) = system_ttf() else { return };
        let mut tables = owned(&data);
        tables.get_mut(b"OS/2").unwrap().truncate(68);
        put_u16(tables.get_mut(b"OS/2").unwrap(), 0, 0);
        put_u32(tables.get_mut(b"post").unwrap(), 0, 0x0002_5000);
        put_u32(tables.get_mut(b"head").unwrap(), 12, 0);
        let fixed = rebuild(&pack(tables), 0).unwrap();
        let rebuilt = read_tables(&fixed, 0).unwrap();
        assert_eq!(rebuilt[b"OS/2"].len(), 96);
        assert_eq!(u32_at(rebuilt[b"post"], 0), Some(0x0003_0000));
        assert_eq!(u32_at(rebuilt[b"head"], 12), Some(0x5F0F_3CF5));
        assert!(ttf_parser::Face::parse(&fixed, 0).is_ok());
    }

    #[test]
    fn bitmap_only_fonts_have_nothing_to_rebuild() {
        let Some(data) = system_ttf() else { return };
        let mut tables = owned(&data);
        tables.remove(b"glyf");
        tables.remove(b"loca");
        assert!(rebuild(&pack(tables), 0).is_none());
    }

    #[test]
    fn cff2_fonts_keep_the_tables_they_depend_on() {
        let Some(data) = system_ttf() else { return };
        let mut tables = owned(&data);
        tables.remove(b"glyf");
        tables.remove(b"loca");
        tables.insert(*b"CFF2", vec![2, 0, 5, 0, 0]);
        tables.insert(*b"fvar", vec![0, 1, 0, 0]);
        let fixed = rebuild(&pack(tables), 0).unwrap();
        let rebuilt = read_tables(&fixed, 0).unwrap();
        assert!(rebuilt.contains_key(b"fvar"));
        assert!(rebuilt.contains_key(b"CFF2"));
    }

    #[test]
    fn variable_truetype_fonts_fall_back_to_their_default_outlines() {
        let Some(data) = system_ttf() else { return };
        let mut tables = owned(&data);
        tables.insert(*b"fvar", vec![0, 1, 0, 0]);
        let fixed = rebuild(&pack(tables), 0).unwrap();
        assert!(!read_tables(&fixed, 0).unwrap().contains_key(b"fvar"));
    }

    #[test]
    fn a_broken_loca_entry_loses_one_glyph_not_the_rest() {
        let mut raw = Vec::new();
        for offset in [0u32, 10, 0xFFFF_FFF0, 20, 30] {
            raw.extend_from_slice(&offset.to_be_bytes());
        }
        let fixed = fix_loca(&raw, true, 4, 40);
        let read = |i: usize| u32_at(&fixed, 4 * i).unwrap();
        assert_eq!((read(0), read(1), read(2), read(3), read(4)), (0, 10, 10, 20, 30));
    }

    #[test]
    fn a_missing_width_table_still_gives_readable_text() {
        let hmtx = fix_hmtx(&[], 1, 3, 1200);
        assert_eq!(u16_at(&hmtx, 0), Some(1200));
        assert_eq!(hmtx.len(), 8);
    }

    #[test]
    fn consecutive_mappings_share_a_group() {
        let pairs: BTreeMap<u32, u16> = [(65, 10), (66, 11), (67, 12), (90, 13)].into();
        let table = build_cmap(&pairs, 100);
        assert_eq!(u32_at(&table, 24), Some(2));
    }

    #[test]
    fn fonts_without_outlines_or_mappings_are_left_alone() {
        assert!(rebuild(b"not a font at all", 0).is_none());
        assert!(rebuild(&[], 0).is_none());
    }
}
