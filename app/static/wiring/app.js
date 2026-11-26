'use strict';

/* ===================================================================
   Model danych
   część:   {id, name, category, desc, pins:[{id,num?,name,type,desc,note?,v?,side?}], name_en?, desc_en?,
             source?:'catalog'}            (pin.desc_en opcjonalnie)
   projekt: {id, title, title_en?, wire:'curve'|'ortho'|'straight',
             nodes:[{id,part,label,label_en?,x,y}],
             links:[{id, a:{n,p}, b:{n,p}, note, note_en?, style?, pts?:[{x,y}]}]}
   Jedno źródło prawdy = połączenia pin↔pin. Widok uproszczony jest z nich
   wyliczany (grupowanie wg pary części i magistrali).
   =================================================================== */

/* ===================================================================
   Osadzanie (etap 9):  const ed = SchematEditor.mount(element, opts)
   opts: {project, readOnly, lang, api: {base, headers}, links: {component}, printCss: [..], onChange(project)}
   Każde wywołanie tworzy niezależny edytor (własny stan, historia, zaznaczenie). Brakujące opcje biorą wartości
   z window.SCH_API / SCH_LINKS / SCH_LANG / SCH_PRINT_CSS (zgodność wsteczna). Bez globalnych id: elementy
   wewnątrz edytora mają atrybut data-r, a $('#x') szuka [data-r="x"] tylko w korzeniu tej instancji.
   =================================================================== */
(function () {
let ACTIVE = null;                 // edytor, który ostatnio dostał kliknięcie / fokus – tylko on obsługuje klawiaturę
let SEQ = 0;
const TEMPLATE = `
    <header data-r="top">
      <strong class="brand" data-i18n="brand">Schemat połączeń</strong>
      <select data-r="projSel" data-i18n-title="project"></select>
      <input data-r="projTitle" data-i18n-ph="projName">
      <button data-r="btnNew" data-i18n="newProject">Nowy projekt</button>
      <span class="sep"></span>
      <button data-r="btnUndo" data-i18n-title="undo">↶</button>
      <button data-r="btnRedo" data-i18n-title="redo">↷</button>
      <span class="sep"></span>
      <div class="seg" data-r="modeSeg">
        <button data-m="simple" data-i18n="modeSimple">Uproszczony</button>
        <button data-m="detail" data-i18n="modeDetail">Szczegółowy</button>
      </div>
      <select data-r="wireSel" data-i18n-title="wireStyle">
        <option value="curve" data-i18n="wire.curve">Przewody: krzywe</option>
        <option value="ortho" data-i18n="wire.ortho">Przewody: kąty proste</option>
        <option value="straight" data-i18n="wire.straight">Przewody: proste</option>
      </select>
      <div class="menuwrap">
        <button data-r="btnView" data-i18n="view">Widok</button>
        <div class="menu left" data-r="viewMenu" hidden>
          <label class="mi"><input type="checkbox" data-r="setIcons"> <span data-i18n="set.icons">Ikony części</span></label>
          <label class="mi"><input type="checkbox" data-r="setPhotos"> <span data-i18n="set.photos">Zdjęcia części (gdy są)</span></label>
          <label class="mi"><input type="checkbox" data-r="setFill"> <span data-i18n="set.labelFill">Wypełnione tło etykiet</span></label>
          <label class="mi"><input type="checkbox" data-r="setHints"> <span data-i18n="set.hints">Podpowiedzi „czego brakuje”</span></label>
          <div class="mi sel"><span data-i18n="orient">Orientacja pinów (widok szczegółowy)</span>
            <select data-r="setOrient" data-i18n-title="orient.note">
              <option value="def" data-i18n="orient.def">wg definicji części (stała)</option>
              <option value="auto" data-i18n="orient.auto">automatyczna (po stronie partnera)</option>
            </select></div>
          <div class="mi sel"><span data-i18n="set.exportTheme">Motyw eksportu obrazów (SVG / PNG)</span>
            <select data-r="setExportTheme">
              <option value="dark" data-i18n="theme.dark">ciemny</option>
              <option value="light" data-i18n="theme.light">jasny</option>
            </select></div>
          <div class="mi sel"><span data-i18n="density">Rozmiar kafelków</span>
            <select data-r="setDensity" data-i18n-title="density.note">
              <option value="auto" data-i18n="density.auto">standardowy (automatyczny)</option>
              <option value="compact" data-i18n="density.compact">kompaktowy</option>
            </select></div>
        </div>
      </div>
      <label class="chk"><input type="checkbox" data-r="editChk" checked> <span data-i18n="edit">Edycja</span></label>
      <button data-r="btnLayout" data-i18n="autoLayout">Auto-układ</button>
      <button data-r="btnNote" data-i18n="note.add" data-i18n-title="note.addTitle">+ Notatka</button>
      <button data-r="btnFit" data-i18n="fit">Dopasuj</button>
      <span class="grow"></span>
      <span data-r="dirty"></span>
      <div class="menuwrap">
        <button data-r="btnExport" data-i18n="export">Eksport</button>
        <div class="menu" data-r="expMenu" hidden>
          <button data-x="json" data-i18n="exp.json">Dane projektu (JSON)</button>
          <button data-x="svg" data-i18n="exp.svg">Obraz SVG (wektor)</button>
          <button data-x="png" data-i18n="exp.png">Obraz PNG</button>
          <button data-x="bom" data-i18n="exp.bom">Lista części (BOM, CSV)</button>
          <button data-x="conn" data-i18n="exp.conn">Lista połączeń (CSV)</button>
          <button data-x="pdf" data-i18n="exp.pdf">PDF (druk do PDF)…</button>
        </div>
      </div>
      <button data-r="btnImport" data-i18n="import">Import</button>
      <input type="file" data-r="fileIn" accept=".json" hidden>
      <button data-r="btnSave" class="pri" data-i18n="save">Zapisz</button>
      <select data-r="langSel" class="lang" title="Language / Język"><option value="pl">PL</option><option value="en">EN</option></select>
    </header>
  
    <main>
      <aside data-r="lib">
        <input data-r="libQ" data-i18n-ph="search">
        <div class="seg mini" data-r="libSeg">
          <button data-s="all" data-i18n="src.all">Wszystkie</button>
          <button data-s="catalog" data-i18n="src.catalog">Katalog</button>
          <button data-s="own" data-i18n="src.own">Własne</button>
        </div>
        <div data-r="libList"></div>
        <button data-r="btnPart" data-i18n="newPart">Nowa część</button>
      </aside>
  
      <section data-r="vp">
        <div data-r="world">
          <svg data-r="wires"></svg>
          <div data-r="nodes"></div>
          <div data-r="labels"></div>
        </div>
        <button class="ptog" data-r="togLib" data-i18n-title="togLib">◧</button>
        <button class="ptog" data-r="togInsp" data-i18n-title="togInsp">◨</button>
        <div data-r="hint"></div>
      </section>
  
      <aside data-r="insp"></aside>
    </main>
  
    <dialog data-r="pdfDlg">
      <h3 data-i18n="pdf.title">Eksport do PDF</h3>
      <label class="chk"><input type="checkbox" data-r="pdfDiagram"> <span data-i18n="pdf.diagram">Schemat (aktualny widok)</span></label>
      <label class="chk"><input type="checkbox" data-r="pdfParts"> <span data-i18n="pdf.parts">Lista części</span></label>
      <label class="chk"><input type="checkbox" data-r="pdfConns"> <span data-i18n="pdf.conns">Lista połączeń</span></label>
      <label class="chk"><input type="checkbox" data-r="pdfCheck"> <span data-i18n="pdf.check">Sprawdzenie (ostrzeżenia)</span></label>
      <label><span data-i18n="pdf.size">Format papieru</span><select data-r="pdfSize"><option value="A4">A4</option><option value="A3">A3</option></select></label>
      <label><span data-i18n="pdf.orient">Orientacja</span>
        <select data-r="pdfOrient"><option value="auto" data-i18n="pdf.orient.auto">automatyczna (wg proporcji schematu)</option><option value="land" data-i18n="pdf.orient.land">pozioma</option><option value="port" data-i18n="pdf.orient.port">pionowa</option></select></label>
      <label><span data-i18n="pdf.theme">Motyw</span>
        <select data-r="pdfTheme"><option value="light" data-i18n="pdf.theme.light">jasny (do druku)</option><option value="dark" data-i18n="pdf.theme.dark">ciemny</option></select></label>
      <p class="muted" data-i18n="pdf.hint"></p>
      <div class="row">
        <button data-r="pdfCancel" data-i18n="part.cancel">Anuluj</button>
        <button data-r="pdfGo" class="pri" data-i18n="pdf.open">Otwórz podgląd</button>
      </div>
    </dialog>
  
    <dialog data-r="dlg">
      <h3 data-r="dlgTitle"></h3>
      <label><span data-i18n="part.name">Nazwa</span><input data-r="pName"></label>
      <label><span data-i18n="part.cat">Kategoria</span><select data-r="pCat"></select></label>
      <label><span data-i18n="part.desc">Opis</span><input data-r="pDesc"></label>
      <label><span data-i18n="part.icon">Ikona</span><select data-r="pIcon"></select></label>
      <label><span data-i18n="part.image">Zdjęcie (adres URL, opcjonalnie)</span><input data-r="pImage" placeholder="/static/…"></label>
      <label><span data-i18n-html="part.pins"></span>
        <textarea data-r="pPins" rows="12" spellcheck="false" placeholder="VCC | power | 3.3 V | 3.3 | L&#10;SDA | i2c_sda | I²C data"></textarea>
      </label>
      <p class="muted" data-r="pTypes"></p>
      <div class="row">
        <button data-r="pCancel" data-i18n="part.cancel">Anuluj</button>
        <button data-r="pSave" class="pri" data-i18n="part.save">Zapisz część</button>
      </div>
    </dialog>
`;

function mount(root, opts = {}) {
if (!root) throw new Error('SchematEditor.mount: brak elementu');
if (root.__sch) root.__sch.destroy();
const UIDP = 'sch' + (++SEQ) + '-';
let inst = null;
const subs = [];
const on = (target, type, fn, o) => { target.addEventListener(type, fn, o); subs.push([target, type, fn, o]); };
const offAll = () => { subs.splice(0).forEach(([tg, ty, fn, o]) => tg.removeEventListener(ty, fn, o)); };
root.classList.add('sch');
root.innerHTML = TEMPLATE;

/* ------------------------------------------------------------------ typy sygnałów (kolory = kategorie pinoutu platformy) */
const BUSC = {power: '#f0883e', gnd: '#9aa7b8', analog: '#4cc3c9', digital: '#5aa9ff', spi: '#8fd16a', i2c: '#e5879c',
  i2s: '#5fd4a8', uart: '#d9a35f', usb: '#a3a6ff', can: '#ffc4a3', pwm: '#d8e06a', debug: '#ff9d9d', rf: '#7ee0ff',
  clock: '#c792ea', control: '#f2cc60', nc: '#7d8898', other: '#b0b8c4'};
const TYPES = {};
Object.keys(BUSC).forEach(b => TYPES[b] = {bus: b, c: BUSC[b]});
TYPES.gpio = {bus: 'digital', c: BUSC.digital};
TYPES.pass = {bus: 'other', c: BUSC.other};          // wyprowadzenie elementu pasywnego (rezystor, kondensator…) – pasuje do wszystkiego
['i2c_sda', 'i2c_scl'].forEach(k => TYPES[k] = {bus: 'i2c', c: BUSC.i2c});
['spi_sck', 'spi_mosi', 'spi_miso', 'spi_cs'].forEach(k => TYPES[k] = {bus: 'spi', c: BUSC.spi});
['uart_tx', 'uart_rx'].forEach(k => TYPES[k] = {bus: 'uart', c: BUSC.uart});

/* Kategorie edytora odpowiadają kategoriom magazynu platformy (Mikrokontrolery→MCU, Zasilacze→Zasilanie, Czujniki→Czujnik,
   Układy scalone→Układ, Moduły→Moduł, Wyświetlacze→Wyświetlacz, Diody→Dioda, Tranzystory→Tranzystor, Rezystory→Rezystor,
   Kondensatory→Kondensator, Złącza→Złącze, Inne→Inne) + „Wykonawczy” (silniki, serwa). Kolory – jak w magazynie. */
const CATS = {MCU: '#00d68f', Zasilanie: '#ffd23f', Układ: '#22d3ee', Moduł: '#7c6cff', Czujnik: '#ff7a1a', Wyświetlacz: '#ff4d8d',
  Wykonawczy: '#2dd4bf', Dioda: '#ff4466', Tranzystor: '#b06cff', Rezystor: '#f5a524', Kondensator: '#4aa3ff', Złącze: '#7ed957', Inne: '#9aa7b8'};
const CAT_ORDER = ['Zasilanie', 'MCU', 'Moduł', 'Układ', 'Wyświetlacz', 'Czujnik', 'Wykonawczy', 'Dioda', 'Tranzystor', 'Rezystor', 'Kondensator', 'Złącze', 'Inne'];
const LAYOUT_COL = {Zasilanie: 0, MCU: 1, Moduł: 1, Układ: 2, Wyświetlacz: 2, Czujnik: 3, Wykonawczy: 3, Dioda: 4, Tranzystor: 4, Rezystor: 4, Kondensator: 4, Złącze: 4, Inne: 4};

/* Ikony 24×24 (kontur, bez zewnętrznych bibliotek) – domyślnie wg kategorii; część może wskazać własną (pole `icon`). */
const ICONS = {
  mcu: '<rect x="6" y="6" width="12" height="12" rx="1.5"/><rect x="9.5" y="9.5" width="5" height="5" rx=".6"/><path d="M9 3v3M12 3v3M15 3v3M9 18v3M12 18v3M15 18v3M3 9h3M3 12h3M3 15h3M18 9h3M18 12h3M18 15h3"/>',
  ic: '<rect x="7" y="3.5" width="10" height="17" rx="1.5"/><path d="M10.5 3.5a1.5 1.5 0 0 0 3 0M3.5 7.5H7M3.5 12H7M3.5 16.5H7M17 7.5h3.5M17 12h3.5M17 16.5h3.5"/>',
  module: '<rect x="3" y="5" width="18" height="14" rx="2"/><rect x="6.5" y="8.5" width="6" height="6" rx=".8"/><path d="M15.5 9h2.5M15.5 12h2.5M15.5 15h2.5"/>',
  sensor: '<circle cx="8.5" cy="15.5" r="1.8"/><path d="M8.5 9.5a6 6 0 0 1 6 6M8.5 4.5a11 11 0 0 1 11 11"/>',
  display: '<rect x="3" y="4.5" width="18" height="12" rx="1.5"/><path d="M9 20h6M12 16.5V20"/>',
  power: '<path d="M13 3 5.5 13.5H11L10 21l8-10.5h-5.5L13 3z"/>',
  conn: '<path d="M9 3v5M15 3v5M7 8h10v3a5 5 0 0 1-10 0V8zM12 16v5"/>',
  res: '<path d="M2.5 12H6l1.5-5 3 10 3-10 3 10 1.5-5h3.5"/>',
  cap: '<path d="M10 5v14M14 5v14M3 12h7M14 12h7"/>',
  diode: '<path d="M7 6.5v11l9-5.5-9-5.5zM17 6.5v11M2.5 12H7M17 12h4.5"/>',
  trans: '<path d="M9 6v12M3 12h6M9 9.5l8-5.5M9 14.5l8 5.5"/>',
  act: '<circle cx="12" cy="12" r="3.2"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
  box: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zM12 12l8-4.5M12 12v9M12 12 4 7.5"/>',
};
const ICON_OF_CAT = {MCU: 'mcu', Zasilanie: 'power', Układ: 'ic', Moduł: 'module', Czujnik: 'sensor', Wyświetlacz: 'display', Wykonawczy: 'act',
  Dioda: 'diode', Tranzystor: 'trans', Rezystor: 'res', Kondensator: 'cap', Złącze: 'conn', Inne: 'box'};
const iconKey = pt => (pt.icon && ICONS[pt.icon]) ? pt.icon : (ICON_OF_CAT[pt.category] || 'box');
const iconSVG = (k, size) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k] || ICONS.box}</svg>`;
const POWER_GND = ['power', 'gnd'];
const WIRE_STYLES = ['curve', 'ortho', 'straight'];

/* ------------------------------------------------------------------ tłumaczenia PL / EN */
const I18N = {
  pl: {
    'brand': 'Schemat połączeń', 'project': 'Schemat', 'projName': 'Nazwa schematu', 'newProject': 'Nowy schemat',
    'undo': 'Cofnij (Ctrl+Z)', 'redo': 'Ponów (Ctrl+Y)', 'modeSimple': 'Uproszczony', 'modeDetail': 'Szczegółowy',
    'wireStyle': 'Styl przewodów', 'wire.curve': 'Przewody: krzywe', 'wire.ortho': 'Przewody: kąty proste', 'wire.straight': 'Przewody: proste',
    'edit': 'Edycja', 'autoLayout': 'Auto-układ', 'fit': 'Dopasuj', 'export': 'Eksport', 'import': 'Import', 'save': 'Zapisz',
    'search': 'Szukaj części…', 'src.all': 'Wszystkie', 'src.catalog': 'Katalog', 'src.own': 'Własne', 'newPart': 'Nowa część',
    'dirty': 'niezapisane zmiany', 'saved': 'zapisano',
    'saveErr': 'Nie zapisano: {0}', 'conflict.ask': 'Ktoś zapisał w międzyczasie nowszą wersję tego schematu.\n\nOK – wczytaj nowszą wersję (Twoje zmiany przepadną)\nAnuluj – zapisz swoją wersję jako kopię',
    'conflict.copy': '(kopia)',
    'hint.detail': 'Przeciągnij z pinu na pin, aby połączyć. Zaznacz przewód i przeciągnij ◇ na środku odcinka, aby dodać punkt zaczepienia. Del usuwa.',
    'hint.detailRo': 'Tryb tylko do odczytu.',
    'hint.simple': 'Widok uproszczony pokazuje, za co odpowiadają połączenia. Piny łączysz w widoku szczegółowym. Zaznacz przewód zbiorczy i przeciągnij ◇, aby dodać punkt zaczepienia.',
    'pins': '{0} wyprowadzeń', 'noParts': 'Brak części', 'editPart': 'Edytuj część', 'badge.catalog': 'katalog',
    'cat.MCU': 'Mikrokontroler', 'cat.Zasilanie': 'Zasilanie', 'cat.Układ': 'Układ scalony', 'cat.Moduł': 'Moduł', 'cat.Czujnik': 'Czujnik',
    'cat.Wyświetlacz': 'Wyświetlacz', 'cat.Wykonawczy': 'Wykonawczy', 'cat.Dioda': 'Dioda', 'cat.Tranzystor': 'Tranzystor',
    'cat.Rezystor': 'Rezystor', 'cat.Kondensator': 'Kondensator', 'cat.Złącze': 'Złącze', 'cat.Inne': 'Inne',
    'bus.power': 'Zasilanie', 'bus.gnd': 'Masa', 'bus.analog': 'Analog', 'bus.digital': 'Cyfrowe', 'bus.pwm': 'PWM', 'bus.i2c': 'I²C',
    'bus.spi': 'SPI', 'bus.uart': 'UART', 'bus.i2s': 'I²S', 'bus.usb': 'USB', 'bus.can': 'CAN', 'bus.debug': 'Debug', 'bus.rf': 'RF',
    'bus.clock': 'Zegar', 'bus.control': 'Sterujące', 'bus.nc': 'Brak poł.', 'bus.other': 'Inne',
    'w.missingPin': 'Pin nie istnieje w definicji części', 'w.pg': '{0} ↔ {1} – zwarcie lub pomyłka?',
    'w.volt': 'Różne napięcia: {0} V ↔ {1} V', 'w.uart': 'UART: TX↔RX trzeba skrzyżować',
    'w.role': 'Niezgodne role sygnałów: {0} ↔ {1}', 'w.mismatch': 'Niezgodne typy: {0} ↔ {1}',
    'conn': 'Połączenie', 'note': 'Opis połączenia', 'notePh': 'np. zasilanie czujnika',
    'style': 'Styl przewodu (w widoku szczegółowym)', 'styleDef': 'domyślny schematu ({0})',
    'style.curve': 'krzywa', 'style.ortho': 'kąty proste', 'style.straight': 'prosta',
    'wpInfo': 'Punkty zaczepienia: {0}. Przeciągnij ◇ na środku odcinka, aby dodać punkt; dwuklik na punkcie go usuwa.',
    'wpTitle': 'Przeciągnij; dwuklik usuwa', 'ghostTitle': 'Przeciągnij, aby dodać punkt zaczepienia',
    'clrPts': 'Wyczyść punkty', 'delLink': 'Usuń połączenie', 'delAll': 'Usuń wszystkie', 'delNode': 'Usuń ze schematu',
    'nodeLabel': 'Etykieta w schemacie', 'pinsH': 'Wyprowadzenia', 'groupInfo': '{0} poł. między {1} a {2}',
    'summary': '{0} części · {1} połączeń', 'checkH': 'Sprawdzenie', 'noIssues': 'Nie znaleziono problemów.',
    'legendH': 'Legenda', 'legend.power': 'Zasilanie (linia przerywana)', 'delProj': 'Usuń schemat',
    'catalogPart': 'Część z katalogu platformy – piny edytujesz w katalogu.', 'details': 'Szczegóły',
    'confirm.discard': 'Masz niezapisane zmiany. Porzucić je?', 'confirm.delProj': 'Usunąć cały schemat?',
    'badFile': 'Nieprawidłowy plik: {0}', 'missingPart': 'Brak części: {0}', 'noLinks': 'brak połączeń',
    'part.new': 'Nowa część', 'part.edit': 'Edycja części', 'part.name': 'Nazwa', 'part.cat': 'Kategoria', 'part.desc': 'Opis',
    'part.pins': 'Wyprowadzenia – jedno w linii: <code>nazwa | typ | opis | napięcie (opc.) | strona L/R (opc.)</code>',
    'part.cancel': 'Anuluj', 'part.save': 'Zapisz część', 'part.types': 'Typy: ',
    'newProjectTitle': 'Nowy schemat',
    'loadMore': 'Załaduj więcej', 'shown': 'Wszystkie części: {0}', 'exp.json': 'Dane schematu (JSON)',
    'exp.svg': 'Obraz SVG (wektor)', 'exp.png': 'Obraz PNG', 'togLib': 'Pokaż / ukryj bibliotekę części',
    'togInsp': 'Pokaż / ukryj panel szczegółów', 'exportErr': 'Nie udało się wyeksportować obrazu',
    'exp.bom': 'Lista części (BOM, CSV)', 'exp.conn': 'Lista połączeń (CSV)',
    'csv.no': 'Lp.', 'csv.part': 'Część', 'csv.category': 'Kategoria', 'csv.qty': 'Ilość', 'csv.refs': 'Oznaczenia',
    'csv.package': 'Obudowa', 'csv.source': 'Źródło', 'csv.partId': 'Id części', 'csv.datasheet': 'Datasheet',
    'csv.net': 'Sieć', 'csv.fromPart': 'Od: część', 'csv.fromPin': 'Od: pin', 'csv.fromNum': 'Od: nr pinu', 'csv.fromFn': 'Od: funkcja',
    'csv.toPart': 'Do: część', 'csv.toPin': 'Do: pin', 'csv.toNum': 'Do: nr pinu', 'csv.toFn': 'Do: funkcja',
    'csv.signal': 'Sygnał', 'csv.note': 'Opis', 'csv.warn': 'Ostrzeżenia',
    'lblPos': 'Pozycja etykiety', 'lp.auto': 'automatyczna (unika nakładania)', 'lp.mid': 'środek przewodu',
    'lp.longest': 'najdłuższy odcinek', 'lp.manual': 'ręczna (przeciągnięta)',
    'lblHint': 'Przeciągnij etykietę wzdłuż przewodu, aby ustawić ją ręcznie.',
    'view': 'Widok', 'set.icons': 'Ikony części', 'set.photos': 'Zdjęcia części (gdy są)', 'set.labelFill': 'Wypełnione tło etykiet',
    'part.icon': 'Ikona', 'part.iconAuto': 'automatyczna (wg kategorii)', 'part.image': 'Zdjęcie (adres URL, opcjonalnie)',
    'orient': 'Orientacja pinów (widok szczegółowy)', 'orient.def': 'wg definicji części (stała)',
    'orient.auto': 'automatyczna (po stronie partnera)', 'orient.note': 'Zapisywane w schemacie',
    'flip': 'Odwróć strony pinów (lewo ↔ prawo)',
    'density': 'Rozmiar kafelków', 'density.auto': 'standardowy (automatyczny)', 'density.compact': 'kompaktowy',
    'density.note': 'Zapisywane w schemacie', 'width': 'Rozmiar kafelka (px): szerokość × wysokość (minimalna)', 'widthAuto': 'szer. auto', 'heightAuto': 'wys. auto', 'widthReset': 'Auto',
    'rszTitle': 'Przeciągnij, aby zmienić rozmiar', 'rszW': 'Przeciągnij, aby zmienić szerokość', 'rszH': 'Przeciągnij, aby zmienić wysokość',
    'exp.pdf': 'PDF (druk do PDF)…', 'pdf.title': 'Eksport do PDF', 'pdf.diagram': 'Schemat (aktualny widok)', 'pdf.parts': 'Lista części',
    'pdf.conns': 'Lista połączeń', 'pdf.check': 'Sprawdzenie (ostrzeżenia)', 'pdf.size': 'Format papieru', 'pdf.orient': 'Orientacja',
    'pdf.orient.auto': 'automatyczna (wg proporcji schematu)', 'pdf.orient.land': 'pozioma', 'pdf.orient.port': 'pionowa',
    'pdf.theme': 'Motyw', 'pdf.theme.light': 'jasny (do druku)', 'pdf.theme.dark': 'ciemny', 'pdf.open': 'Otwórz podgląd',
    'pdf.printBtn': 'Drukuj / zapisz jako PDF', 'pdf.hint': 'W oknie druku wybierz „Zapisz jako PDF”, wyłącz „Nagłówki i stopki” i włącz „Grafika w tle”.',
    'pdf.popup': 'Przeglądarka zablokowała nowe okno – zezwól na wyskakujące okna dla tej strony.', 'pdf.noContent': 'Zaznacz co najmniej jedną sekcję.',
    'pdf.from': 'Od', 'pdf.to': 'Do', 'set.exportTheme': 'Motyw eksportu obrazów (SVG / PNG)', 'theme.dark': 'ciemny', 'theme.light': 'jasny',
    'checkWarn': 'Ostrzeżenia', 'checkHints': 'Podpowiedzi', 'set.hints': 'Podpowiedzi „czego brakuje”',
    'v.noPower': 'Część „{0}”: nie podłączono żadnego pinu zasilania',
    'v.noGnd': 'Część „{0}”: nie podłączono żadnego pinu masy',
    'v.gndSplit': 'Brak wspólnej masy – osobne grupy: {0}',
    'v.voltNet': 'W jednej sieci zasilania są różne napięcia ({0}): {1}',
    'v.spiCs': 'SPI: część „{0}” ma podłączone linie SPI, ale nie podłączono CS',
    'h.noLinks': 'Część „{0}” nie ma żadnych połączeń',
    'h.i2cPull': 'I²C ({0}): w sieci nie ma rezystora podciągającego ({1}). Wiele modułów ma go na płytce – jeśli nie, dodaj rezystor ok. 4,7 kΩ do zasilania',
    'h.decouple': 'Część „{0}”: przy zasilaniu nie ma kondensatora (zalecany odsprzęgający ok. 100 nF blisko pinu)',
    'openCard': 'Otwórz kartę komponentu ↗', 'openCardTitle': 'Karta komponentu w katalogu (nowa karta)',
    'value': 'Wartość', 'valueOther': 'Wartość / oznaczenie (opcjonalnie)', 'valuePh': 'np. 4k7, 100n, 2,2u',
    'valueOtherPh': 'np. 1N4148, BC547, 16 MHz', 'valueHint': 'Wpisz liczbę albo skrót (4k7 = 4,7 kΩ, 100n = 100 nF); listę typowych wartości (szereg E12) rozwiniesz w polu.',
    'csv.value': 'Wartość',
    'note.add': '+ Notatka', 'note.addTitle': 'Dodaj notatkę (komentarz) na płótnie', 'note.title': 'Notatka', 'note.text': 'Treść', 'note.ph': 'np. tu dodać dzielnik napięcia',
    'note.color': 'Kolor', 'nc.note': 'żółta', 'nc.info': 'niebieska', 'nc.warn': 'pomarańczowa', 'nc.ok': 'zielona', 'note.width': 'Szerokość (px)',
    'note.empty': 'Pusta notatka', 'note.del': 'Usuń notatkę', 'copy': 'Kopiuj (Ctrl+C)', 'delSelected': 'Usuń zaznaczone',
    'multi.title': 'Zaznaczone elementy: {0}', 'multi.info': 'części: {0} · notatki: {1}', 'align': 'Wyrównaj', 'distribute': 'Rozłóż równo',
    'al.left': 'Wyrównaj do lewej krawędzi', 'al.left.s': 'lewo', 'al.hcenter': 'Wyśrodkuj w poziomie', 'al.hcenter.s': 'środek',
    'al.right': 'Wyrównaj do prawej krawędzi', 'al.right.s': 'prawo', 'al.top': 'Wyrównaj do górnej krawędzi', 'al.top.s': 'góra',
    'al.vmiddle': 'Wyśrodkuj w pionie', 'al.vmiddle.s': 'środek', 'al.bottom': 'Wyrównaj do dolnej krawędzi', 'al.bottom.s': 'dół',
    'al.dh': 'Równe odstępy w poziomie (min. 3 elementy)', 'al.dh.s': 'poziomo', 'al.dv': 'Równe odstępy w pionie (min. 3 elementy)', 'al.dv.s': 'pionowo',
    'multi.hint': 'Shift+klik dodaje lub usuwa element z zaznaczenia, Shift+przeciągnięcie tła zaznacza ramką, Ctrl+A – wszystko. Ctrl+C / Ctrl+X / Ctrl+V – kopiuj / wytnij / wklej (z połączeniami między zaznaczonymi częściami, także do innego schematu), Ctrl+D – duplikuj, strzałki – przesuń (Shift: o 50 px), Esc – odznacz.',
    'hint.sel': 'Shift+przeciągnięcie tła zaznacza kilka elementów.',
    'hint.touch': 'Jeden palec przesuwa widok, dwa palce powiększają, przytrzymanie palca na tle zaznacza ramką.',
    'collapse': 'Zwiń kafelek (tylko nagłówek)', 'col.btnC': 'Zwiń kafelek', 'col.btnE': 'Rozwiń kafelek (połączeń: {0})',
    'col.all': 'Zwiń zaznaczone', 'col.none': 'Rozwiń zaznaczone',
  },
  en: {
    'brand': 'Wiring diagram', 'project': 'Diagram', 'projName': 'Diagram name', 'newProject': 'New diagram',
    'undo': 'Undo (Ctrl+Z)', 'redo': 'Redo (Ctrl+Y)', 'modeSimple': 'Simplified', 'modeDetail': 'Detailed',
    'wireStyle': 'Wire style', 'wire.curve': 'Wires: curved', 'wire.ortho': 'Wires: right angles', 'wire.straight': 'Wires: straight',
    'edit': 'Edit', 'autoLayout': 'Auto layout', 'fit': 'Fit', 'export': 'Export', 'import': 'Import', 'save': 'Save',
    'search': 'Search parts…', 'src.all': 'All', 'src.catalog': 'Catalog', 'src.own': 'Own', 'newPart': 'New part',
    'dirty': 'unsaved changes', 'saved': 'saved',
    'saveErr': 'Not saved: {0}', 'conflict.ask': 'Someone saved a newer version of this schematic in the meantime.\n\nOK – load the newer version (your changes will be lost)\nCancel – save your version as a copy',
    'conflict.copy': '(copy)',
    'hint.detail': 'Drag from pin to pin to connect. Select a wire and drag the ◇ at a segment’s midpoint to add a waypoint. Del removes.',
    'hint.detailRo': 'Read-only mode.',
    'hint.simple': 'The simplified view shows what each connection is for. Connect pins in the detailed view. Select a grouped wire and drag the ◇ to add a waypoint.',
    'pins': '{0} pins', 'noParts': 'No parts', 'editPart': 'Edit part', 'badge.catalog': 'catalog',
    'cat.MCU': 'Microcontroller', 'cat.Zasilanie': 'Power', 'cat.Układ': 'IC', 'cat.Moduł': 'Module', 'cat.Czujnik': 'Sensor',
    'cat.Wyświetlacz': 'Display', 'cat.Wykonawczy': 'Actuator', 'cat.Dioda': 'Diode', 'cat.Tranzystor': 'Transistor',
    'cat.Rezystor': 'Resistor', 'cat.Kondensator': 'Capacitor', 'cat.Złącze': 'Connector', 'cat.Inne': 'Other',
    'bus.power': 'Power', 'bus.gnd': 'Ground', 'bus.analog': 'Analog', 'bus.digital': 'Digital', 'bus.pwm': 'PWM', 'bus.i2c': 'I²C',
    'bus.spi': 'SPI', 'bus.uart': 'UART', 'bus.i2s': 'I²S', 'bus.usb': 'USB', 'bus.can': 'CAN', 'bus.debug': 'Debug', 'bus.rf': 'RF',
    'bus.clock': 'Clock', 'bus.control': 'Control', 'bus.nc': 'N/C', 'bus.other': 'Other',
    'w.missingPin': 'Pin is missing from the part definition', 'w.pg': '{0} ↔ {1} – short circuit or mistake?',
    'w.volt': 'Different voltages: {0} V ↔ {1} V', 'w.uart': 'UART: TX and RX must be crossed',
    'w.role': 'Mismatched signal roles: {0} ↔ {1}', 'w.mismatch': 'Incompatible types: {0} ↔ {1}',
    'conn': 'Connection', 'note': 'Connection note', 'notePh': 'e.g. sensor power',
    'style': 'Wire style (detailed view)', 'styleDef': 'diagram default ({0})',
    'style.curve': 'curved', 'style.ortho': 'right angles', 'style.straight': 'straight',
    'wpInfo': 'Waypoints: {0}. Drag the ◇ at a segment’s midpoint to add a point; double-click a point to remove it.',
    'wpTitle': 'Drag; double-click removes', 'ghostTitle': 'Drag to add a waypoint',
    'clrPts': 'Clear points', 'delLink': 'Delete connection', 'delAll': 'Delete all', 'delNode': 'Remove from diagram',
    'nodeLabel': 'Label in diagram', 'pinsH': 'Pins', 'groupInfo': '{0} connection(s) between {1} and {2}',
    'summary': '{0} parts · {1} connections', 'checkH': 'Check', 'noIssues': 'No issues found.',
    'legendH': 'Legend', 'legend.power': 'Power (dashed line)', 'delProj': 'Delete diagram',
    'catalogPart': 'Part from the platform catalog – edit its pins in the catalog.', 'details': 'Details',
    'confirm.discard': 'You have unsaved changes. Discard them?', 'confirm.delProj': 'Delete the whole diagram?',
    'badFile': 'Invalid file: {0}', 'missingPart': 'Missing part: {0}', 'noLinks': 'no connections',
    'part.new': 'New part', 'part.edit': 'Edit part', 'part.name': 'Name', 'part.cat': 'Category', 'part.desc': 'Description',
    'part.pins': 'Pins – one per line: <code>name | type | description | voltage (opt.) | side L/R (opt.)</code>',
    'part.cancel': 'Cancel', 'part.save': 'Save part', 'part.types': 'Types: ',
    'newProjectTitle': 'New diagram',
    'loadMore': 'Load more', 'shown': 'All parts: {0}', 'exp.json': 'Diagram data (JSON)',
    'exp.svg': 'SVG image (vector)', 'exp.png': 'PNG image', 'togLib': 'Show / hide the parts library',
    'togInsp': 'Show / hide the details panel', 'exportErr': 'Could not export the image',
    'exp.bom': 'Parts list (BOM, CSV)', 'exp.conn': 'Connections list (CSV)',
    'csv.no': 'No.', 'csv.part': 'Part', 'csv.category': 'Category', 'csv.qty': 'Qty', 'csv.refs': 'References',
    'csv.package': 'Package', 'csv.source': 'Source', 'csv.partId': 'Part id', 'csv.datasheet': 'Datasheet',
    'csv.net': 'Net', 'csv.fromPart': 'From: part', 'csv.fromPin': 'From: pin', 'csv.fromNum': 'From: pin no.', 'csv.fromFn': 'From: function',
    'csv.toPart': 'To: part', 'csv.toPin': 'To: pin', 'csv.toNum': 'To: pin no.', 'csv.toFn': 'To: function',
    'csv.signal': 'Signal', 'csv.note': 'Note', 'csv.warn': 'Warnings',
    'lblPos': 'Label position', 'lp.auto': 'automatic (avoids overlaps)', 'lp.mid': 'wire midpoint',
    'lp.longest': 'longest segment', 'lp.manual': 'manual (dragged)',
    'lblHint': 'Drag the label along the wire to place it manually.',
    'view': 'View', 'set.icons': 'Part icons', 'set.photos': 'Part photos (when available)', 'set.labelFill': 'Filled label background',
    'part.icon': 'Icon', 'part.iconAuto': 'automatic (by category)', 'part.image': 'Photo (URL, optional)',
    'orient': 'Pin orientation (detailed view)', 'orient.def': 'as defined by the part (fixed)',
    'orient.auto': 'automatic (facing the partner)', 'orient.note': 'Saved with the diagram',
    'flip': 'Mirror pin sides (left ↔ right)',
    'density': 'Tile size', 'density.auto': 'standard (automatic)', 'density.compact': 'compact',
    'density.note': 'Saved with the diagram', 'width': 'Tile size (px): width × height (minimum)', 'widthAuto': 'width auto', 'heightAuto': 'height auto', 'widthReset': 'Auto',
    'rszTitle': 'Drag to resize', 'rszW': 'Drag to change the width', 'rszH': 'Drag to change the height',
    'exp.pdf': 'PDF (print to PDF)…', 'pdf.title': 'Export to PDF', 'pdf.diagram': 'Diagram (current view)', 'pdf.parts': 'Parts list',
    'pdf.conns': 'Connections list', 'pdf.check': 'Check (warnings)', 'pdf.size': 'Paper size', 'pdf.orient': 'Orientation',
    'pdf.orient.auto': 'automatic (by diagram proportions)', 'pdf.orient.land': 'landscape', 'pdf.orient.port': 'portrait',
    'pdf.theme': 'Theme', 'pdf.theme.light': 'light (for printing)', 'pdf.theme.dark': 'dark', 'pdf.open': 'Open preview',
    'pdf.printBtn': 'Print / save as PDF', 'pdf.hint': 'In the print dialog choose “Save as PDF”, turn off “Headers and footers” and turn on “Background graphics”.',
    'pdf.popup': 'The browser blocked the new window – allow pop-ups for this site.', 'pdf.noContent': 'Select at least one section.',
    'pdf.from': 'From', 'pdf.to': 'To', 'set.exportTheme': 'Image export theme (SVG / PNG)', 'theme.dark': 'dark', 'theme.light': 'light',
    'checkWarn': 'Warnings', 'checkHints': 'Hints', 'set.hints': '“What’s missing” hints',
    'v.noPower': 'Part “{0}”: no power pin is connected',
    'v.noGnd': 'Part “{0}”: no ground pin is connected',
    'v.gndSplit': 'No common ground – separate groups: {0}',
    'v.voltNet': 'Different voltages in one power net ({0}): {1}',
    'v.spiCs': 'SPI: part “{0}” has SPI lines connected but CS is not connected',
    'h.noLinks': 'Part “{0}” has no connections',
    'h.i2cPull': 'I²C ({0}): no pull-up resistor in the net ({1}). Many modules have one on the board – if not, add about 4.7 kΩ to the supply',
    'h.decouple': 'Part “{0}”: no capacitor on the supply (a ~100 nF decoupling capacitor close to the pin is recommended)',
    'openCard': 'Open component page ↗', 'openCardTitle': 'Component page in the catalog (new tab)',
    'value': 'Value', 'valueOther': 'Value / designation (optional)', 'valuePh': 'e.g. 4k7, 100n, 2.2u',
    'valueOtherPh': 'e.g. 1N4148, BC547, 16 MHz', 'valueHint': 'Type a number or shorthand (4k7 = 4.7 kΩ, 100n = 100 nF); the field offers common values (E12 series).',
    'csv.value': 'Value',
    'note.add': '+ Note', 'note.addTitle': 'Add a note (comment) on the canvas', 'note.title': 'Note', 'note.text': 'Text', 'note.ph': 'e.g. add a voltage divider here',
    'note.color': 'Colour', 'nc.note': 'yellow', 'nc.info': 'blue', 'nc.warn': 'orange', 'nc.ok': 'green', 'note.width': 'Width (px)',
    'note.empty': 'Empty note', 'note.del': 'Delete note', 'copy': 'Copy (Ctrl+C)', 'delSelected': 'Delete selected',
    'multi.title': 'Selected items: {0}', 'multi.info': 'parts: {0} · notes: {1}', 'align': 'Align', 'distribute': 'Distribute evenly',
    'al.left': 'Align left edges', 'al.left.s': 'left', 'al.hcenter': 'Centre horizontally', 'al.hcenter.s': 'centre',
    'al.right': 'Align right edges', 'al.right.s': 'right', 'al.top': 'Align top edges', 'al.top.s': 'top',
    'al.vmiddle': 'Centre vertically', 'al.vmiddle.s': 'middle', 'al.bottom': 'Align bottom edges', 'al.bottom.s': 'bottom',
    'al.dh': 'Equal horizontal spacing (min. 3 items)', 'al.dh.s': 'horizontal', 'al.dv': 'Equal vertical spacing (min. 3 items)', 'al.dv.s': 'vertical',
    'multi.hint': 'Shift+click adds or removes an item, Shift+drag on the background selects with a box, Ctrl+A selects all. Ctrl+C / Ctrl+X / Ctrl+V – copy / cut / paste (with connections between selected parts, also into another diagram), Ctrl+D – duplicate, arrows – move (Shift: 50 px), Esc – deselect.',
    'hint.sel': 'Shift+drag on the background selects several items.',
    'hint.touch': 'One finger pans, two fingers zoom, press and hold on the background to box-select.',
    'collapse': 'Collapse tile (header only)', 'col.btnC': 'Collapse tile', 'col.btnE': 'Expand tile (connections: {0})',
    'col.all': 'Collapse selected', 'col.none': 'Expand selected',
  },
};
let LANG = opts.lang || localStorage.getItem('sch.lang') || window.SCH_LANG || ((navigator.language || 'pl').startsWith('pl') ? 'pl' : 'en');
if (!I18N[LANG]) LANG = 'pl';
const t = (k, ...a) => { let s = I18N[LANG][k] ?? I18N.pl[k] ?? k; a.forEach((v, i) => { s = s.split('{' + i + '}').join(v); }); return s; };
const busName = b => t('bus.' + b);
const catName = c => (I18N[LANG]['cat.' + c] ?? c);
const loc = (o, f) => (LANG === 'en' && o[f + '_en']) || o[f];          // pole z wersją angielską, z powrotem na PL

/* ------------------------------------------------------------------ stan */
const S = {parts: {}, lib: {items: [], total: 0, page: 0, pages: 1, busy: false}, projects: [], p: null, mode: 'simple', edit: true, sel: null, dirty: false, libSrc: 'all',
           view: {x: 40, y: 40, k: 1}, drag: null, geo: {}, last: {}};
S.edit = !opts.readOnly;
const H = {stack: [], i: 0, timer: null};   // historia zmian (cofnij / ponów)

const COARSE = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);   // ekran dotykowy jako główne wejście
const RQ = s => s.replace(/#([A-Za-z][\w-]*)/g, '[data-r="$1"]');       // '#vp' → '[data-r="vp"]' (bez globalnych id)
const $ = s => root.querySelector(RQ(s));
const $$ = s => [...root.querySelectorAll(RQ(s))];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const uid = () => Math.random().toString(36).slice(2, 9);
const T = x => TYPES[x] || TYPES.other;
const snap = v => Math.round(v / 10) * 10;
/* Ustawienia widoku – preferencja użytkownika (localStorage), nie część projektu. */
const SET = {icons: true, photos: true, labelFill: false, exportTheme: 'dark', hints: true};
const PDF_DEF = {diagram: true, parts: true, conns: true, check: true, size: 'A4', orient: 'auto', theme: 'light'};
try { Object.assign(SET, JSON.parse(localStorage.getItem('sch.set') || '{}')); } catch (e) { /* domyślne */ }
SET.pdf = Object.assign({}, PDF_DEF, SET.pdf || {});
const saveSettings = () => { try { localStorage.setItem('sch.set', JSON.stringify(SET)); } catch (e) { /* tryb prywatny */ } };
function applySettings() {
  root.classList.toggle('fill-labels', !!SET.labelFill);
  $('#setExportTheme').value = SET.exportTheme === 'light' ? 'light' : 'dark';
  $('#setHints').checked = SET.hints !== false;
  $('#setIcons').checked = !!SET.icons; $('#setPhotos').checked = !!SET.photos; $('#setFill').checked = !!SET.labelFill;
}
const nodeEl = id => $(`#nodes .node[data-id="${id}"]`);
const nodeEls = () => [...$$('#nodes .node')];

/* Punkt integracji z platformą: przed załadowaniem skryptu można ustawić
   window.SCH_API = { base: '/api/wiring', headers: () => ({Authorization: 'Bearer ' + localStorage.getItem('access_token')}) } */
async function api(method, url, body) {
  const cfg = opts.api || window.SCH_API || {};
  if (typeof cfg.call === 'function') return cfg.call(method, url, body);   // ESN: własna warstwa danych (np. tryb gościa w localStorage)
  const r = await fetch((cfg.base || '/api') + url, {method, cache: 'no-store',
    headers: {'Content-Type': 'application/json', ...(cfg.headers ? cfg.headers() : {})},
    body: body === undefined ? undefined : JSON.stringify(body)});
  if (!r.ok) {                                                              // ESN: status i treść błędu (409 = konflikt wersji)
    const txt = await r.text(), e = new Error(txt);
    e.status = r.status; try { e.data = JSON.parse(txt); } catch (x) { /* nie-JSON */ }
    throw e;
  }
  return r.json();
}
/* ESN: komunikat błędu z serwera (FastAPI {detail}) – tłumaczony przez platformę, jeśli jest dostępna */
function errText(e) {
  const d = e && e.data && e.data.detail, m = typeof d === 'string' ? d : (d && d.message) || (e && e.message) || '';
  return window.ESNI18n && window.ESNI18n.err ? window.ESNI18n.err(m) : m;
}

/* ------------------------------------------------------------------ helpers */
const nodeById = id => S.p.nodes.find(n => n.id === id);
const partOf = n => S.parts[n.part];
const nodeLabel = n => loc(n, 'label') || (partOf(n) && loc(partOf(n), 'name')) || '?';
const noteOf = l => loc(l, 'note') || '';
const titleOf = p => loc(p, 'title') || p.id;

/* Link do karty komponentu w platformie (etap 12): window.SCH_LINKS = { component: catalogId => '/…' }.
   Bez haka (demo) link jest ukryty. Dotyczy tylko części z katalogu (pole catalog_id). Dozwolone tylko adresy http(s) i ścieżki. */
function cardUrl(pt) {
  const L = opts.links || window.SCH_LINKS, f = L && L.component;
  if (!pt || pt.source !== 'catalog' || pt.catalog_id == null || typeof f !== 'function') return '';
  let u = ''; try { u = String(f(pt.catalog_id) || ''); } catch (e) { return ''; }
  return /^(https?:\/\/|\/(?!\/))/i.test(u) ? u : '';
}

/* Wartość elementu w węźle (n.value – tekst, np. "4.7 kΩ", "100 nF", "1N4148"). Dla rezystorów i kondensatorów pomocnik
   z jednostką i skrótami (4k7, 4R7, 100n, 2,2u); zapis zawsze z kropką dziesiętną, wyświetlanie wg języka. */
const VAL_UNITS = {Rezystor: ['Ω', 'kΩ', 'MΩ'], Kondensator: ['pF', 'nF', 'µF', 'mF']};
const VAL_PREFIX = {Rezystor: {'': 'Ω', r: 'Ω', k: 'kΩ', m: 'MΩ'}, Kondensator: {p: 'pF', n: 'nF', u: 'µF', 'µ': 'µF', m: 'mF'}};
const E12 = [1, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2];
const VAL_MAX = 40;
function parseValue(text, cat, unit) {          // -> {num, unit} albo null (tekst nie jest liczbą z jednostką)
  const units = VAL_UNITS[cat]; if (!units) return null;
  let s = String(text || '').trim().replace(/\s+/g, '').replace(',', '.');
  s = s.replace(/(ohm|om|Ω)$/i, '').replace(/F$/, '');
  const m = s.match(/^(\d+(?:\.\d+)?|\.\d+)([pnuµmkKMrR]?)(\d*)$/);
  if (!m) return null;
  let pre = m[2], num = parseFloat(m[1]);
  if (m[3]) { if (!pre || m[1].includes('.')) return null; num = parseFloat(m[1] + '.' + m[3]); }   // 4k7 -> 4.7 k
  if (!isFinite(num) || num <= 0) return null;
  pre = pre === 'M' ? 'm' : pre.toLowerCase();
  if (cat === 'Rezystor' && m[2] === 'm') return null;                          // „m” przy rezystorze jest niejednoznaczne
  const u = pre ? VAL_PREFIX[cat][pre] : (units.includes(unit) ? unit : units[0]);
  return u ? {num: +num.toPrecision(6), unit: u} : null;
}
const valueStr = v => v.num + ' ' + v.unit;
function splitValue(str, cat) {                  // zapisany tekst -> {num, unit}, jeśli pasuje do jednostek kategorii
  const m = String(str || '').match(/^(\d+(?:\.\d+)?)\s(\S+)$/);
  return m && (VAL_UNITS[cat] || []).includes(m[2]) ? {num: +m[1], unit: m[2]} : null;
}
const fmtNum = n => LANG === 'pl' ? String(n).replace('.', ',') : String(n);
const fmtValue = str => String(str || '').replace(/^(\d+)\.(\d+)(?=\s)/, (a, x, y) => LANG === 'pl' ? x + ',' + y : a);
const nodeValue = n => (typeof n.value === 'string' && n.value.trim()) ? fmtValue(n.value.trim()) : '';
const sideOf = (pt, pin) => pin.side || (pt.pins.indexOf(pin) % 2 ? 'R' : 'L');
function pinOf(ref) {
  const n = nodeById(ref.n), pt = n && partOf(n);
  return pt && pt.pins.find(p => p.id === ref.p);
}
const pinLabel = p => p.name;                                            // numer wyprowadzenia (katalog) pokazywany osobno
/* Strona pinu na kafelku (widok szczegółowy): z definicji części (sideOf) albo – przy orientacji „auto” – po stronie,
   z której leży partner (średnia po połączeniach); piny bez połączeń zostają po stronie z definicji. `flip` odwraca całość. */
function pinSide(n, pt, pin) {
  const s = (S.p.orient === 'auto' && S.sides && S.sides.get(n.id + '|' + pin.id)) || sideOf(pt, pin);
  return n.flip ? (s === 'L' ? 'R' : 'L') : s;
}
const nodeWidth = n => n.w || (S.p.density === 'compact' ? (S.mode === 'detail' ? 240 : 190) : (S.mode === 'detail' ? 330 : 250));
function computeSides() {
  const m = new Map();
  if (S.p.orient !== 'auto') return m;
  const cx = {}; S.p.nodes.forEach(n => { cx[n.id] = n.x + nodeWidth(n) / 2; });
  const acc = new Map();
  S.p.links.forEach(l => [[l.a, l.b], [l.b, l.a]].forEach(([me, other]) => {
    if (me.n === other.n || cx[me.n] === undefined || cx[other.n] === undefined) return;
    const k = me.n + '|' + me.p, v = acc.get(k) || 0;
    acc.set(k, v + (cx[other.n] - cx[me.n]));
  }));
  acc.forEach((v, k) => { if (v !== 0) m.set(k, v < 0 ? 'L' : 'R'); });
  return m;
}
const refName = ref => { const n = nodeById(ref.n), p = pinOf(ref); return `${n ? nodeLabel(n) : '?'}.${p ? pinLabel(p) : ref.p}`; };
const wireStyle = l => (l && l.style) || (S.p && S.p.wire) || 'curve';
const groupKey = l => [l.a.n, l.b.n].sort().join('|') + '|' + info(l).bus;

/* Zgodność sygnałów (poza zasilaniem/masą). Zwraca tekst ostrzeżenia albo ''. */
function compat(a, b) {
  const ta = a.type, tb = b.type;
  if (ta === 'gpio' || tb === 'gpio') return '';
  const ba = T(ta).bus, bb = T(tb).bus;
  if (ba === bb) {
    if (ba === 'uart') return (ta === tb && ta !== 'uart') ? t('w.uart') : '';
    if (ba === 'i2c' || ba === 'spi') return (ta !== tb && ta !== ba && tb !== ba) ? t('w.role', ta, tb) : '';
    return '';
  }
  const loose = ['digital', 'pwm', 'control', 'clock'];
  return (loose.includes(ba) && loose.includes(bb)) ? '' : t('w.mismatch', busName(ba), busName(bb));
}

/* Typ połączenia + ostrzeżenia (walidacja „czy to ma sens") */
function info(l) {
  const a = pinOf(l.a), b = pinOf(l.b), warn = [];
  if (!a || !b) return {type: 'other', bus: 'other', c: '#ff4466', warn: [t('w.missingPin')]};
  if (a.type === 'pass' || b.type === 'pass') {                  // element pasywny pasuje do każdego sygnału, zasilania i masy
    let ty = a.type === 'pass' ? b.type : a.type; if (ty === 'pass') ty = 'other';
    return {type: ty, bus: T(ty).bus, c: T(ty).c, warn: []};
  }
  let type, volt = false;
  if (POWER_GND.includes(a.type) || POWER_GND.includes(b.type)) {
    if (a.type !== b.type) warn.push(t('w.pg', busName(T(a.type).bus), busName(T(b.type).bus)));
    else if (a.type === 'power' && a.v && b.v && +a.v !== +b.v) { warn.push(t('w.volt', a.v, b.v)); volt = true; }
    type = POWER_GND.includes(a.type) ? a.type : b.type;
  } else {
    const w = compat(a, b); if (w) warn.push(w);
    type = a.type === 'gpio' ? b.type : a.type;
    if (type === 'gpio') type = 'digital';
  }
  return {type, bus: T(type).bus, c: T(type).c, warn, volt};
}
/* ------------------------------------------------------------------ walidacja projektu
   Reguły działają na danych, które mają dziś wszystkie części (typ pinu, kategoria części, opcjonalne `v`).
   Reguły wymagające kierunku pinu, tolerancji 5 V, zakresów zasilania itd. wymagają rozszerzenia formatu pinoutu (README, 10.3). */
function buildNets(groundInternal) {
  const par = new Map();
  const find = x => { if (!par.has(x)) par.set(x, x); let r = x; while (par.get(r) !== r) r = par.get(r); par.set(x, r); return r; };
  const key = r => r.n + '|' + r.p;
  S.p.links.forEach(l => par.set(find(key(l.a)), find(key(l.b))));
  if (groundInternal) {                                         // piny masy jednej części traktujemy jako wspólne
    S.p.nodes.forEach(n => {
      const pt = partOf(n); if (!pt) return;
      const g = pt.pins.filter(q => q.type === 'gnd');
      for (let i = 1; i < g.length; i++) par.set(find(n.id + '|' + g[0].id), find(n.id + '|' + g[i].id));
    });
  }
  return {find, key};
}

/* Zwraca {warns, hints, byNode}; element: {text, nodes:[id], link?}. Ostrzeżenia = prawdopodobne błędy, podpowiedzi = zalecenia. */
function validate() {
  const out = {warns: [], hints: [], byNode: new Map()};
  if (!S.p) return out;
  const lbl = id => { const n = nodeById(id); return n ? nodeLabel(n) : '?'; };
  const add = (list, text, nodes, link) => {
    if (list === 'hints' && SET.hints === false) return;
    out[list].push({text, nodes: nodes || [], link: link || null});
    (nodes || []).forEach(id => { const e = out.byNode.get(id) || {warns: [], hints: []}; e[list].push(text); out.byNode.set(id, e); });
  };

  // 1. połączenia pin ↔ pin (typy, napięcia)
  S.p.links.forEach(l => info(l).warn.forEach(w => add('warns', `${refName(l.a)} → ${refName(l.b)}: ${w}`, [l.a.n, l.b.n], l.id)));

  // 2. reguły dla części
  const linked = new Map();
  S.p.links.forEach(l => [l.a, l.b].forEach(r => { if (!linked.has(r.n)) linked.set(r.n, new Set()); linked.get(r.n).add(r.p); }));
  const nets = buildNets(false), gnets = buildNets(true);
  const netPins = new Map();                                    // sieć -> [{n, pin}]
  S.p.links.forEach(l => [l.a, l.b].forEach(r => {
    const pin = pinOf(r); if (!pin) return;
    const root = nets.find(nets.key(r)); if (!netPins.has(root)) netPins.set(root, new Map());
    netPins.get(root).set(nets.key(r), {n: r.n, pin});
  }));
  const capRoots = new Set();                                   // sieci, w których jest kondensator
  netPins.forEach((m, root) => m.forEach(x => { if (partOf(nodeById(x.n) || {})?.category === 'Kondensator') capRoots.add(root); }));

  for (const n of S.p.nodes) {
    const pt = partOf(n); if (!pt) continue;
    const con = linked.get(n.id);
    if (!con || !con.size) { if (S.p.nodes.length > 1) add('hints', t('h.noLinks', nodeLabel(n)), [n.id]); continue; }
    const of = type => pt.pins.filter(q => q.type === type), anyCon = list => list.some(q => con.has(q.id));
    const pw = of('power'), gd = of('gnd'), cs = of('spi_cs');
    if (pw.length && pt.category !== 'Zasilanie' && !anyCon(pw)) add('warns', t('v.noPower', nodeLabel(n)), [n.id]);
    if (gd.length && !anyCon(gd)) add('warns', t('v.noGnd', nodeLabel(n)), [n.id]);
    if (cs.length && !anyCon(cs) && pt.pins.some(q => ['spi_sck', 'spi_mosi', 'spi_miso'].includes(q.type) && con.has(q.id))) add('warns', t('v.spiCs', nodeLabel(n)), [n.id]);
    if (pt.category === 'Układ') {                              // goły układ scalony: zalecany kondensator odsprzęgający
      const roots = pw.filter(q => con.has(q.id)).map(q => nets.find(nets.key({n: n.id, p: q.id})));
      if (roots.length && !roots.some(r => capRoots.has(r))) add('hints', t('h.decouple', nodeLabel(n)), [n.id]);
    }
  }

  // 3. wspólna masa: wszystkie podłączone masy powinny tworzyć jedną sieć
  const groups = new Map();
  for (const n of S.p.nodes) {
    const pt = partOf(n), con = linked.get(n.id); if (!pt || !con) continue;
    const g = pt.pins.find(q => q.type === 'gnd' && con.has(q.id)); if (!g) continue;
    const root = gnets.find(gnets.key({n: n.id, p: g.id}));
    if (!groups.has(root)) groups.set(root, []); groups.get(root).push(n.id);
  }
  if (groups.size > 1) { const gl = [...groups.values()]; add('warns', t('v.gndSplit', gl.map(g => g.map(lbl).join(', ')).join('  |  ')), gl.flat()); }

  // 4. sieci: różne napięcia zasilania w jednej sieci (połączenia bezpośrednie są już zgłaszane w pkt 1) i brak podciągnięcia I²C
  const voltRoots = new Set();
  S.p.links.forEach(l => { if (info(l).volt) voltRoots.add(nets.find(nets.key(l.a))); });
  netPins.forEach((m, root) => {
    const items = [...m.values()], ids = [...new Set(items.map(x => x.n))];
    const vs = new Map();
    items.forEach(x => { if (x.pin.type === 'power' && x.pin.v) { const k = String(+x.pin.v); if (!vs.has(k)) vs.set(k, new Set()); vs.get(k).add(x.n); } });
    if (vs.size > 1 && !voltRoots.has(root)) add('warns', t('v.voltNet', [...vs.keys()].map(v => v + ' V').join(' / '), ids.map(lbl).join(', ')), ids);
    const types = new Set(items.map(x => x.pin.type));
    const line = types.has('i2c_sda') ? 'SDA' : types.has('i2c_scl') ? 'SCL' : types.has('i2c') ? 'I²C' : null;
    if (line && ids.length >= 2 && !ids.some(id => partOf(nodeById(id) || {})?.category === 'Rezystor')) add('hints', t('h.i2cPull', line, ids.map(lbl).join(', ')), ids);
  });
  return out;
}

/* ------------------------------------------------------------------ historia (undo / redo) */
const snapshot = () => JSON.stringify(S.p);
function histReset() { clearTimeout(H.timer); H.timer = null; H.stack = [snapshot()]; H.i = 0; updUndo(); }
function commit() {
  clearTimeout(H.timer); H.timer = null;
  const s = snapshot(); if (s === H.stack[H.i]) { updUndo(); return; }
  H.stack = H.stack.slice(0, H.i + 1); H.stack.push(s);
  if (H.stack.length > 100) H.stack.shift();
  H.i = H.stack.length - 1; updUndo();
}
function mark() {                       // zmiana projektu: oznacz jako niezapisany, zatwierdź w historii po chwili
  S.dirty = true; $('#dirty').textContent = t('dirty');
  if (typeof opts.onChange === 'function') { try { opts.onChange(S.p); } catch (e) { /* błąd w kodzie osadzającym */ } }
  clearTimeout(H.timer); H.timer = setTimeout(commit, 350); updUndo();
}
function restore(i) {
  H.i = i; const id = S.p.id;
  S.p = JSON.parse(H.stack[i]); S.p.id = id;
  S.dirty = true; $('#dirty').textContent = t('dirty'); S.sel = null; render(); updUndo();
}
function undo() { if (H.timer) commit(); if (H.i > 0) restore(H.i - 1); }
function redo() { if (H.timer) commit(); if (H.i < H.stack.length - 1) restore(H.i + 1); }
function updUndo() { $('#btnUndo').disabled = !(H.i > 0 || H.timer); $('#btnRedo').disabled = H.i >= H.stack.length - 1; }

/* ------------------------------------------------------------------ język */
function applyStatic() {
  root.lang = LANG; $('#langSel').value = LANG;
  $$('[data-i18n]').forEach(e => e.textContent = t(e.dataset.i18n));
  $$('[data-i18n-html]').forEach(e => e.innerHTML = t(e.dataset.i18nHtml));
  $$('[data-i18n-ph]').forEach(e => e.placeholder = t(e.dataset.i18nPh));
  $$('[data-i18n-title]').forEach(e => e.title = t(e.dataset.i18nTitle));
  $('#pCat').innerHTML = CAT_ORDER.map(c => `<option value="${c}">${esc(catName(c))}</option>`).join('');
  $('#pIcon').innerHTML = `<option value="">${esc(t('part.iconAuto'))}</option>` + CAT_ORDER.map(c => `<option value="${ICON_OF_CAT[c]}">${esc(catName(c))}</option>`).join('');
}

/* ------------------------------------------------------------------ render */
function render() { renderTop(); renderLib(); renderCanvas(); renderInsp(); }

function renderTop() {
  $('#projSel').innerHTML = S.projects.map(p => `<option value="${esc(p.id)}">${esc(titleOf(p))}</option>`).join('');
  if (S.p) { $('#projSel').value = S.p.id; $('#projTitle').value = titleOf(S.p) === S.p.id ? '' : titleOf(S.p); $('#wireSel').value = S.p.wire || 'curve'; }
  $$('#modeSeg button').forEach(b => b.classList.toggle('on', b.dataset.m === S.mode));
  $$('#libSeg button').forEach(b => b.classList.toggle('on', b.dataset.s === S.libSrc));
  root.classList.toggle('ro', !S.edit);
  if (S.p) {
    $('#setOrient').value = S.p.orient || 'def'; $('#setOrient').disabled = !S.edit;
    $('#setDensity').value = S.p.density || 'auto'; $('#setDensity').disabled = !S.edit;
  }
  $('#hint').textContent = (S.mode === 'detail' ? t(S.edit ? 'hint.detail' : 'hint.detailRo') : t('hint.simple')) + ' ' + t(COARSE ? 'hint.touch' : 'hint.sel');
}

function renderLib() {
  const L = S.lib, by = {}, order = [];
  L.items.forEach(p => { if (!by[p.category]) { by[p.category] = []; order.push(p.category); } by[p.category].push(p); });
  let html = order.map(c => `<div class="lcat">${esc(catName(c))}</div>` + by[c].map(p =>
    `<div class="litem" data-add="${esc(p.id)}" style="--c:${CATS[p.category] || CATS.Inne}" title="${esc(loc(p, 'desc') || '')}">
       <span class="pico lico">${iconSVG(iconKey(p), 17)}</span><div class="nm">${esc(loc(p, 'name'))}<small>${t('pins', p.pins)}${p.source === 'catalog' ? ` · <b class="badge">${t('badge.catalog')}</b>` : ''}</small></div>
       ${p.source === 'catalog' ? '' : `<button class="ed" data-ed="${esc(p.id)}" title="${esc(t('editPart'))}">✎</button>`}</div>`).join('')).join('');
  if (!L.items.length) html = `<div class="muted">${L.busy ? '…' : t('noParts')}</div>`;
  if (L.page < L.pages) html += `<button class="more" data-r="libMore">${t('loadMore')} (${L.items.length}/${L.total})</button>`;
  else if (L.items.length) html += `<div class="muted cnt">${t('shown', L.total)}</div>`;
  $('#libList').innerHTML = html;
}

/* Lekka lista części: serwer zwraca same podsumowania (bez pinów), z wyszukiwaniem i paginacją.
   Pełna definicja części (z pinami) jest pobierana dopiero, gdy jest potrzebna (dodanie do schematu, otwarcie projektu). */
let libTimer;
async function loadLib(reset) {
  const L = S.lib;
  if (L.busy) { if (reset) { clearTimeout(libTimer); libTimer = setTimeout(() => loadLib(true), 200); } return; }
  L.busy = true;
  const page = reset ? 1 : L.page + 1;
  try {
    const r = await api('GET', `/parts?q=${encodeURIComponent($('#libQ').value)}&src=${S.libSrc}&page=${page}&limit=30`);
    S.lib = {items: reset ? r.items : L.items.concat(r.items), total: r.total, page: r.page, pages: r.pages, busy: false};
  } catch (e) { L.busy = false; }
  renderLib();
}
async function ensureParts(ids) {
  const miss = [...new Set(ids)].filter(i => i && !S.parts[i]);
  if (!miss.length) return;
  (await api('GET', '/parts/batch?ids=' + encodeURIComponent(miss.join(',')))).forEach(p => { S.parts[p.id] = p; });
}

function nbadgeHTML(n) {
  const e = S.val && S.val.byNode.get(n.id);
  return e && e.warns.length ? `<span class="nbadge" title="${esc(e.warns.join('\n'))}">⚠ ${e.warns.length}</span>` : '';
}

/* Znaczek części: zdjęcie (jeśli jest i włączone w „Widok”), w przeciwnym razie ikona wg kategorii / własna. */
function picoHTML(pt) {
  const photo = SET.photos && pt.image;
  if (!SET.icons && !photo) return '';
  const k = iconKey(pt);
  return `<span class="pico${photo ? ' photo' : ''}" data-icon="${k}"${photo ? ` data-img="${esc(pt.image)}"` : ''}>${iconSVG(k, 18)}${photo ? `<img src="${esc(pt.image)}" alt="" loading="lazy">` : ''}</span>`;
}

function nodeHTML(n) {
  const pt = partOf(n);
  const col = CATS[pt?.category] || CATS.Inne;
  if (!pt) return `<div class="node" data-id="${n.id}" style="left:${n.x}px;top:${n.y}px"><div class="nh">${esc(t('missingPart', n.part))}</div></div>`;
  const used = new Set();
  S.p.links.forEach(l => [l.a, l.b].forEach(r => r.n === n.id && used.add(r.p)));
  let body;
  if (n.collapsed) body = '';
  else if (S.mode === 'detail') {
    const L = [], R = [];
    pt.pins.forEach(p => (pinSide(n, pt, p) === 'L' ? L : R).push(p));
    const row = (p, s) => `<div class="pin ${s}${used.has(p.id) ? ' used' : ''}" data-p="${esc(p.id)}" title="${esc(loc(p, 'desc') || '')}">
      <i class="dot" style="--c:${T(p.type).c}"></i>${p.num ? `<span class="pnum">${esc(p.num)}</span>` : ''}<span class="pn">${esc(p.name)}</span><em>${busName(T(p.type).bus)}${p.v ? ' ' + esc(p.v) + ' V' : ''}</em></div>`;
    body = `<div class="pins"><div>${L.map(p => row(p, 'L')).join('')}</div><div>${R.map(p => row(p, 'R')).join('')}</div></div>`;
  } else {
    const groups = {};
    S.p.links.forEach(l => {
      const i = info(l);
      [l.a, l.b].forEach(r => {
        if (r.n !== n.id) return;
        const pin = pinOf(r);
        const g = groups[i.bus] = groups[i.bus] || {c: i.c, pins: new Map()};
        if (pin) g.pins.set(pin.id, pin);
      });
    });
    body = '<div class="roles">' + (Object.entries(groups).map(([bus, g]) =>
      `<div class="role-h" style="--c:${g.c}">${esc(busName(bus))}</div>` +
      [...g.pins.values()].map(p => `<div class="role" title="${esc(loc(p, 'desc') || '')}"><b>${esc(p.name)}</b><span>${esc(loc(p, 'desc') || '')}</span></div>`).join('')
    ).join('') || `<div class="muted">${t('noLinks')}</div>`) + '</div>';
  }
  const ncon = S.p.links.filter(l => l.a.n === n.id || l.b.n === n.id).length;
  const colBtn = `<button class="ncol" title="${esc(n.collapsed ? t('col.btnE', ncon) : t('col.btnC'))}">${n.collapsed ? '▸' : '▾'}</button>`;
  return `<div class="node${selIds().includes(n.id) ? ' sel' : ''}${n.w ? ' sized' : ''}${n.collapsed ? ' collapsed' : ''}" data-id="${n.id}" style="left:${n.x}px;top:${n.y}px${n.w ? `;width:${n.w}px` : ''}${n.h && !n.collapsed ? `;min-height:${n.h}px` : ''}">
    <div class="nh" style="--c:${col}">${picoHTML(pt)}<div class="nht"><b>${esc(nodeLabel(n))}</b>${nodeValue(n) ? `<span class="nval">${esc(nodeValue(n))}</span>` : ''}<small>${esc(loc(pt, 'name'))} · ${esc(catName(pt.category))}</small></div><span class="nhr">${nbadgeHTML(n)}${cardUrl(pt) ? `<a class="nlink" href="${esc(cardUrl(pt))}" target="_blank" rel="noopener noreferrer" title="${esc(t('openCardTitle'))}">↗</a>` : ''}${colBtn}</span></div>${body}<span class="rsz" data-ax="xy" title="${esc(t('rszTitle'))}"></span><span class="rsz-r" data-ax="x" title="${esc(t('rszW'))}"></span><span class="rsz-b" data-ax="y" title="${esc(t('rszH'))}"></span></div>`;
}

function renderCanvas() {
  if (!S.p) return;
  $('#world').classList.toggle('detail', S.mode === 'detail');
  $('#world').classList.toggle('compact', S.p.density === 'compact');
  S.sides = computeSides();
  S.val = validate();
  $('#nodes').innerHTML = S.p.nodes.map(nodeHTML).join('') + (S.p.notes || []).map(noteHTML).join('');
  applyView();
  drawWires();
}

function applyView() {
  const v = S.view;
  $('#world').style.transform = `translate(${v.x}px,${v.y}px) scale(${v.k})`;
}

/* ------------------------------------------------------------------ routing przewodów */
const dedupe = P => P.filter((p, i) => !i || p.x !== P[i - 1].x || p.y !== P[i - 1].y);

function polyPath(P, r) {                 // łamana, opcjonalnie z zaokrąglonymi rogami
  P = dedupe(P);
  let d = `M${P[0].x},${P[0].y}`;
  if (!r || P.length < 3) return d + P.slice(1).map(p => `L${p.x},${p.y}`).join('');
  for (let i = 1; i < P.length - 1; i++) {
    const a = P[i - 1], b = P[i], c = P[i + 1];
    const l1 = Math.hypot(b.x - a.x, b.y - a.y), l2 = Math.hypot(c.x - b.x, c.y - b.y), rr = Math.min(r, l1 / 2, l2 / 2);
    d += `L${b.x + (a.x - b.x) / l1 * rr},${b.y + (a.y - b.y) / l1 * rr}Q${b.x},${b.y} ${b.x + (c.x - b.x) / l2 * rr},${b.y + (c.y - b.y) / l2 * rr}`;
  }
  const z = P[P.length - 1];
  return d + `L${z.x},${z.y}`;
}

function spline(P) {                      // Catmull-Rom → krzywe Béziera
  let d = `M${P[0].x},${P[0].y}`;
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[i - 1] || P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || P[i + 1];
    d += `C${p1.x + (p2.x - p0.x) / 6},${p1.y + (p2.y - p0.y) / 6} ${p2.x - (p3.x - p1.x) / 6},${p2.y - (p3.y - p1.y) / 6} ${p2.x},${p2.y}`;
  }
  return d;
}

function polyMid(P) {                     // punkt w połowie długości łamanej (do etykiety)
  const len = P.slice(1).map((p, i) => Math.hypot(p.x - P[i].x, p.y - P[i].y)), tot = len.reduce((a, b) => a + b, 0);
  let acc = 0;
  for (let i = 0; i < len.length; i++) {
    if (acc + len[i] >= tot / 2) { const f = len[i] ? (tot / 2 - acc) / len[i] : 0; return {x: P[i].x + (P[i + 1].x - P[i].x) * f, y: P[i].y + (P[i + 1].y - P[i].y) * f}; }
    acc += len[i];
  }
  return P[0];
}

function cubicPts(a, c1, c2, b, n) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n, u = 1 - f;
    out.push({x: u * u * u * a.x + 3 * u * u * f * c1.x + 3 * u * f * f * c2.x + f * f * f * b.x,
              y: u * u * u * a.y + 3 * u * u * f * c1.y + 3 * u * f * f * c2.y + f * f * f * b.y});
  }
  return out;
}
function splinePts(P) {                   // te same krzywe co spline(), jako łamana (do ustawiania etykiet)
  let out = [];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[i - 1] || P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || P[i + 1];
    const seg = cubicPts(p1, {x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6},
                         {x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6}, p2, 10);
    out = out.concat(i ? seg.slice(1) : seg);
  }
  return out;
}
/* Etykiety na trasie: położenie opisujemy ułamkiem t ∈ [0,1] długości łamanej */
function polyInfo(P) {
  const seg = [], cum = [0]; let tot = 0;
  for (let i = 1; i < P.length; i++) { const l = Math.hypot(P[i].x - P[i - 1].x, P[i].y - P[i - 1].y); seg.push(l); tot += l; cum.push(tot); }
  return {seg, cum, tot};
}
function pointAt(P, inf, tt) {
  const target = Math.max(0, Math.min(1, tt)) * inf.tot;
  for (let i = 0; i < inf.seg.length; i++) {
    if (inf.cum[i + 1] >= target) { const f = inf.seg[i] ? (target - inf.cum[i]) / inf.seg[i] : 0; return {x: P[i].x + (P[i + 1].x - P[i].x) * f, y: P[i].y + (P[i + 1].y - P[i].y) * f}; }
  }
  return P[P.length - 1];
}
function longestT(P, inf) {               // środek najdłuższego odcinka
  let best = 0; inf.seg.forEach((l, i) => { if (l > inf.seg[best]) best = i; });
  return inf.tot ? (inf.cum[best] + inf.seg[best] / 2) / inf.tot : .5;
}
function nearestT(P, inf, q) {            // rzut punktu na trasę → ułamek długości
  let bd = 1e9, bt = .5;
  for (let i = 0; i < inf.seg.length; i++) {
    const a = P[i], b = P[i + 1], dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1;
    const u = Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / l2));
    const d = Math.hypot(q.x - (a.x + u * dx), q.y - (a.y + u * dy));
    if (d < bd) { bd = d; bt = (inf.cum[i] + u * inf.seg[i]) / (inf.tot || 1); }
  }
  return bt;
}

function route(p1, p2, wp, style) {       // p = {x,y,d}; d = kierunek wyjścia z części (−1 lewo, +1 prawo)
  wp = wp || [];
  if (style === 'straight') { const P = dedupe([p1, ...wp, p2]); return {d: polyPath(P, 0), mid: polyMid(P), pts: P}; }
  if (style === 'ortho') {
    const s1 = {x: p1.x + p1.d * 18, y: p1.y}, s2 = {x: p2.x + p2.d * 18, y: p2.y};
    let mid = [];
    if (wp.length) {
      let a = s1;
      for (const b of [...wp, s2]) { mid.push({x: b.x, y: a.y}); if (b !== s2) mid.push(b); a = b; }
    } else if (p1.d !== p2.d && p1.d * (s2.x - s1.x) >= 0) {
      const mx = (s1.x + s2.x) / 2; mid = [{x: mx, y: s1.y}, {x: mx, y: s2.y}];
    } else if (p1.d === p2.d) {
      const mx = p1.d > 0 ? Math.max(s1.x, s2.x) : Math.min(s1.x, s2.x); mid = [{x: mx, y: s1.y}, {x: mx, y: s2.y}];
    } else {
      const my = (s1.y + s2.y) / 2; mid = [{x: s1.x, y: my}, {x: s2.x, y: my}];
    }
    const P = dedupe([p1, s1, ...mid, s2, p2]);
    return {d: polyPath(P, 10), mid: polyMid(P), pts: P};
  }
  if (!wp.length) {                        // krzywa Béziera
    const k = Math.max(40, Math.abs(p2.x - p1.x) / 2);
    const pts = cubicPts(p1, {x: p1.x + p1.d * k, y: p1.y}, {x: p2.x + p2.d * k, y: p2.y}, p2, 24);
    return {d: `M${p1.x},${p1.y}C${p1.x + p1.d * k},${p1.y} ${p2.x + p2.d * k},${p2.y} ${p2.x},${p2.y}`, mid: polyMid(pts), pts};
  }
  const P = [p1, {x: p1.x + p1.d * 20, y: p1.y}, ...wp, {x: p2.x + p2.d * 20, y: p2.y}, p2];
  return {d: spline(P), mid: polyMid(P), pts: splinePts(P)};
}

function drawWires() {
  if (!S.p) return;
  const k = S.view.k, wr = $('#world').getBoundingClientRect();
  const rect = e => { const r = e.getBoundingClientRect(); return {x: (r.left - wr.left) / k, y: (r.top - wr.top) / k, w: r.width / k, h: r.height / k}; };
  const edges = [];
  S.geo = {};

  if (S.mode === 'detail') {
    const coll = {}, cside = r => { const n = nodeById(r.n), pt = n && partOf(n), pin = pinOf(r); return pt && pin ? pinSide(n, pt, pin) : 'L'; };
    S.p.links.forEach(l => [l.a, l.b].forEach((r, w) => {          // końce przy zwiniętych kafelkach, pogrupowane wg boku
      if (!nodeById(r.n)?.collapsed) return;
      (coll[r.n + '|' + cside(r)] = coll[r.n + '|' + cside(r)] || []).push(l.id + '|' + w);
    }));
    for (const l of S.p.links) {
      const pts = [l.a, l.b].map((r, w) => {
        const ne = nodeEl(r.n); if (!ne) return null;
        if (nodeById(r.n)?.collapsed) {
          const sd = cside(r), arr = coll[r.n + '|' + sd], i = arr.indexOf(l.id + '|' + w), rr = rect(ne);
          return {x: sd === 'L' ? rr.x : rr.x + rr.w, y: rr.y + rr.h * (i + 1) / (arr.length + 1), d: sd === 'L' ? -1 : 1};
        }
        const pe = [...ne.querySelectorAll('.pin')].find(e => e.dataset.p === r.p); if (!pe) return null;
        const d = rect(pe.querySelector('.dot'));
        return {x: d.x + d.w / 2, y: d.y + d.h / 2, d: pe.classList.contains('L') ? -1 : 1};
      });
      if (!pts[0] || !pts[1]) continue;
      edges.push({key: l.id, t: 'link', p1: pts[0], p2: pts[1], i: info(l), label: noteOf(l), wp: l.pts, style: wireStyle(l), lp: l.lp});
    }
  } else {
    const groups = new Map();
    for (const l of S.p.links) {
      const i = info(l), key = groupKey(l);
      if (!groups.has(key)) groups.set(key, {key, a: l.a.n, b: l.b.n, i, links: []});
      groups.get(key).links.push(l);
    }
    const slots = {};
    const list = [...groups.values()].map(g => {
      const ea = nodeEl(g.a), eb = nodeEl(g.b);
      if (!ea || !eb || g.a === g.b) return null;
      const ra = rect(ea), rb = rect(eb), right = ra.x + ra.w / 2 <= rb.x + rb.w / 2;
      g.sa = right ? 'R' : 'L'; g.sb = right ? 'L' : 'R'; g.ra = ra; g.rb = rb;
      (slots[g.a + g.sa] = slots[g.a + g.sa] || []).push(g);
      (slots[g.b + g.sb] = slots[g.b + g.sb] || []).push(g);
      return g;
    }).filter(Boolean);
    const pos = (g, w) => {
      const node = w === 'a' ? g.a : g.b, side = w === 'a' ? g.sa : g.sb, r = w === 'a' ? g.ra : g.rb;
      const arr = slots[node + side], idx = arr.indexOf(g);
      return {x: side === 'R' ? r.x + r.w : r.x, y: r.y + r.h * (idx + 1) / (arr.length + 1), d: side === 'R' ? 1 : -1};
    };
    for (const g of list) {
      const one = g.links.length === 1 ? g.links[0] : null;
      const label = one && noteOf(one) ? noteOf(one)
        : one ? `${busName(g.i.bus)}: ${pinOf(one.a)?.name}→${pinOf(one.b)?.name}` : `${busName(g.i.bus)} ×${g.links.length}`;
      edges.push({key: g.key, t: 'group', p1: pos(g, 'a'), p2: pos(g, 'b'), i: {...g.i, warn: g.links.flatMap(l => info(l).warn)}, label, style: S.p.wire || 'curve', lp: (S.p.glabels || {})[g.key], wp: (S.p.gpts || {})[g.key]});
    }
  }

  // trasy i rozmiar etykiet
  const items = edges.map(e => {
    const r = route(e.p1, e.p2, e.wp, e.style), inf = polyInfo(r.pts), warn = e.i.warn.length > 0;
    S.geo[e.key] = {p1: e.p1, p2: e.p2, mid: r.mid, pts: r.pts, info: inf};
    const text = (S.mode === 'simple' || e.label || warn) ? (warn ? '⚠ ' : '') + (e.label || busName(e.i.bus)) : '';
    return {e, r, inf, warn, text, w: text ? Math.max(28, text.length * 6.2 + 18) : 0, h: 17};
  });

  /* Pozycja etykiety: ręczna (lp = liczba 0…1, przeciągnięta), „mid" (środek), „longest" (środek najdłuższego odcinka)
     albo automatyczna: kandydaci na trasie od najlepszego miejsca w obie strony, wybierany jest pierwszy bez nakładania
     na inne etykiety i na części. */
  const nodeRects = [...$$('#nodes .node, #nodes .tnote')].map(rect), placed = [];
  const box = (p, it) => ({x: p.x - it.w / 2, y: p.y - it.h / 2, w: it.w, h: it.h});
  const ov = (A, B, m) => Math.max(0, Math.min(A.x + A.w + m, B.x + B.w) - Math.max(A.x - m, B.x)) * Math.max(0, Math.min(A.y + A.h + m, B.y + B.h) - Math.max(A.y - m, B.y));
  const baseT = it => it.e.style === 'curve' ? .5 : longestT(it.r.pts, it.inf);
  const fixedT = it => { const lp = it.e.lp; return typeof lp === 'number' ? lp : lp === 'mid' ? .5 : lp === 'longest' ? baseT(it) : null; };
  const labeled = items.filter(it => it.text);
  labeled.filter(it => fixedT(it) !== null).forEach(it => { it.pos = pointAt(it.r.pts, it.inf, fixedT(it)); placed.push(box(it.pos, it)); });
  /* Kara za przecięcie cudzych przewodów: etykieta na obcym przewodzie myli, do którego połączenia należy.
     Najpierw szybki test prostokątów obwiedni, potem odcinek ↔ prostokąt (Liang–Barsky). */
  const WIRE_PEN = 40;
  items.forEach(it => { const xs = it.r.pts.map(q => q.x), ys = it.r.pts.map(q => q.y), x0 = Math.min(...xs), y0 = Math.min(...ys);
    it.bb = {x: x0, y: y0, w: Math.max(...xs) - x0, h: Math.max(...ys) - y0}; });
  const segHits = (a, b, B) => {
    let t0 = 0, t1 = 1; const dx = b.x - a.x, dy = b.y - a.y, P = [-dx, dx, -dy, dy], Q = [a.x - B.x, B.x + B.w - a.x, a.y - B.y, B.y + B.h - a.y];
    for (let i = 0; i < 4; i++) {
      if (P[i] === 0) { if (Q[i] < 0) return false; continue; }
      const q = Q[i] / P[i];
      if (P[i] < 0) { if (q > t1) return false; if (q > t0) t0 = q; } else { if (q < t0) return false; if (q < t1) t1 = q; }
    }
    return true;
  };
  const wireCross = (bx, self) => {
    let n = 0;
    for (const o of items) {
      const q = o.bb; if (o === self || q.x > bx.x + bx.w || q.x + q.w < bx.x || q.y > bx.y + bx.h || q.y + q.h < bx.y) continue;
      const P = o.r.pts; for (let i = 1; i < P.length; i++) if (segHits(P[i - 1], P[i], bx)) { n++; break; }
    }
    return n;
  };
  labeled.filter(it => fixedT(it) === null).forEach(it => {
    const t0 = baseT(it), cands = [t0];
    for (let n = 1; n <= 24; n++) { const dd = n * 0.035; if (t0 + dd <= .94) cands.push(t0 + dd); if (t0 - dd >= .06) cands.push(t0 - dd); }
    let best = null;
    for (const tt of cands) {
      const pos = pointAt(it.r.pts, it.inf, tt), bx = box(pos, it), pen = Math.abs(tt - t0) * 25;
      let c = pen;
      placed.forEach(o => { c += ov(bx, o, 3) * 4; });
      nodeRects.forEach(o => { c += ov(bx, o, 0) * 2; });
      if (!S.drag && c < (best ? best.c : Infinity)) c += wireCross(bx, it) * WIRE_PEN;   // podczas przeciągania pomijamy (szybkość); liczone po puszczeniu
      if (!best || c < best.c) best = {c, pos};
      if (c <= pen) break;                                 // wolne miejsce – bierzemy najbliższe najlepszego
    }
    it.pos = best.pos; placed.push(box(best.pos, it));
  });

  let svg = '', lab = '';
  for (const it of items) {
    const e = it.e, r = it.r, sel = S.sel && S.sel.t === e.t && S.sel.id === e.key, id = esc(e.key);
    svg += `<g style="--c:${e.i.c}" data-e="${id}" data-t="${e.t}"><path class="hit" d="${r.d}"/>` +
           `<path class="w${e.i.type === 'power' ? ' pw' : ''}${sel ? ' sel' : ''}${it.warn ? ' warn' : ''}" d="${r.d}"/></g>`;
    if (it.text)
      lab += `<div class="elabel${sel ? ' sel' : ''}${it.warn ? ' warn' : ''}" style="--c:${e.i.c};left:${it.pos.x}px;top:${it.pos.y}px" data-e="${id}" data-t="${e.t}" title="${esc(e.i.warn.join('; '))}">${esc(it.text)}</div>`;
  }
  if (S.sel && ((S.sel.t === 'link' && S.mode === 'detail') || (S.sel.t === 'group' && S.mode === 'simple')) && S.edit && S.geo[S.sel.id]) {   // uchwyty punktów zaczepienia
    const g = S.geo[S.sel.id], pts = getPts(S.sel.t, S.sel.id) || [];
    const seq = [g.p1, ...pts, g.p2];
    for (let i = 0; i < seq.length - 1; i++) {                 // „duchy" na środku odcinków – przeciągnięcie tworzy nowy punkt
      const m = pts.length ? {x: (seq[i].x + seq[i + 1].x) / 2, y: (seq[i].y + seq[i + 1].y) / 2} : g.mid;
      lab += `<div class="wp ghost" data-seg="${i}" data-x="${m.x}" data-y="${m.y}" style="left:${m.x}px;top:${m.y}px" title="${esc(t('ghostTitle'))}"></div>`;
    }
    pts.forEach((p, i) => { lab += `<div class="wp" data-wp="${i}" style="left:${p.x}px;top:${p.y}px" title="${esc(t('wpTitle'))}"></div>`; });
  }
  $('#wires').innerHTML = svg;
  $('#labels').innerHTML = lab;
}

/* ------------------------------------------------------------------ inspektor */
function conns(nodeId, pinId) {
  return S.p.links.filter(l => (l.a.n === nodeId && l.a.p === pinId) || (l.b.n === nodeId && l.b.p === pinId))
    .map(l => refName(l.a.n === nodeId && l.a.p === pinId ? l.b : l.a));
}

/* Punkty zaczepienia: dla połączenia (`links[].pts`, widok szczegółowy) albo dla grupy przewodów (`gpts[klucz grupy]`, widok uproszczony). */
const getPts = (ty, key) => ty === 'group' ? (S.p.gpts || {})[key] : (S.p.links.find(l => l.id === key) || {}).pts;
function setPts(ty, key, pts) {
  const none = !pts || !pts.length;
  if (ty === 'group') {
    S.p.gpts = S.p.gpts || {};
    if (none) delete S.p.gpts[key]; else S.p.gpts[key] = pts;
    if (!Object.keys(S.p.gpts).length) delete S.p.gpts;
  } else { const l = S.p.links.find(x => x.id === key); if (l) { if (none) delete l.pts; else l.pts = pts; } }
}
const getLp = (ty, key) => ty === 'group' ? (S.p.glabels || {})[key] : (S.p.links.find(l => l.id === key) || {}).lp;
function setLp(ty, key, v) {
  if (ty === 'group') {
    S.p.glabels = S.p.glabels || {};
    if (v === undefined) delete S.p.glabels[key]; else S.p.glabels[key] = v;
    if (!Object.keys(S.p.glabels).length) delete S.p.glabels;
  } else { const l = S.p.links.find(x => x.id === key); if (l) { if (v === undefined) delete l.lp; else l.lp = v; } }
}
const lpControl = (ty, key) => { const v = getLp(ty, key); return `<label>${t('lblPos')}<select data-r="iLp" ${S.edit ? '' : 'disabled'}>
  <option value="">${t('lp.auto')}</option><option value="mid"${v === 'mid' ? ' selected' : ''}>${t('lp.mid')}</option>
  <option value="longest"${v === 'longest' ? ' selected' : ''}>${t('lp.longest')}</option>
  ${typeof v === 'number' ? `<option value="manual" selected>${t('lp.manual')}</option>` : ''}</select></label>
  <div class="muted" style="margin-top:4px">${t('lblHint')}</div>`; };
const bindLp = (ty, key) => { const el = $('#iLp'); if (el) el.onchange = e => { const v = e.target.value; if (v === 'manual') return; setLp(ty, key, v || undefined); mark(); drawWires(); }; };

/* Pole „Wartość” w panelu węzła: dla rezystorów i kondensatorów liczba + jednostka (z listą E12), dla reszty dowolny tekst. */
function valueControl(n, pt) {
  const dis = S.edit ? '' : 'disabled', units = VAL_UNITS[pt.category];
  if (!units) return `<label>${t('valueOther')}<input data-r="iVal" maxlength="${VAL_MAX}" value="${esc(n.value || '')}" placeholder="${esc(t('valueOtherPh'))}" ${dis}></label>`;
  const sv = splitValue(n.value, pt.category), unit = sv ? sv.unit : (pt.category === 'Rezystor' ? 'kΩ' : 'nF');
  const opts = [...new Set([1, 10, 100].flatMap(k => E12.map(b => +(b * k).toPrecision(3))))].map(x => `<option value="${fmtNum(x)}">`).join('');
  return `<label>${t('value')}<span class="wrow"><input data-r="iVal" list="${UIDP}ValList" maxlength="${VAL_MAX}" value="${esc(sv ? fmtNum(sv.num) : (n.value || ''))}" placeholder="${esc(t('valuePh'))}" ${dis}>` +
    `<select data-r="iValU" ${dis}>${units.map(u => `<option${u === unit ? ' selected' : ''}>${u}</option>`).join('')}</select></span></label>` +
    `<datalist id="${UIDP}ValList">${opts}</datalist><div class="muted" style="margin-top:4px">${esc(t('valueHint'))}</div>`;
}
function bindValue(n, pt) {
  const inp = $('#iVal'), us = $('#iValU'); if (!inp) return;
  const apply = () => {
    const raw = inp.value.trim().slice(0, VAL_MAX), v = parseValue(raw, pt.category, us && us.value);
    const val = v ? valueStr(v) : raw;
    if ((n.value || '') === val) return;
    if (val) n.value = val; else delete n.value;
    mark(); renderCanvas(); renderInsp();
  };
  inp.onchange = apply;
  inp.onkeydown = e => { if (e.key === 'Enter') inp.blur(); };
  if (us) us.onchange = apply;
}

function renderInsp() {
  const el = $('#insp'), sel = S.sel;
  if (!S.p) { el.innerHTML = ''; return; }
  const noteInput = l => `<label>${t('note')}<input data-note="${l.id}" value="${esc(noteOf(l))}" placeholder="${esc(t('notePh'))}" ${S.edit ? '' : 'disabled'}></label>`;

  if (sel && sel.t === 'node' && nodeById(sel.id)) {
    const n = nodeById(sel.id), pt = partOf(n), cat = pt?.source === 'catalog';
    el.innerHTML = `<h3>${esc(nodeLabel(n))}</h3>
      <div class="muted">${esc(pt ? loc(pt, 'name') : '')} · ${esc(pt ? catName(pt.category) : '')}${pt?.package ? ' · ' + esc(pt.package) : ''}</div>${pt && loc(pt, 'desc') ? `<p>${esc(loc(pt, 'desc'))}</p>` : ''}
      <label>${t('nodeLabel')}<input data-r="iLabel" value="${esc(loc(n, 'label') || '')}" placeholder="${esc(pt ? loc(pt, 'name') : '')}" ${S.edit ? '' : 'disabled'}></label>
      ${pt ? valueControl(n, pt) : ''}
      <label>${t('width')}<span class="wrow"><input type="number" data-r="iW" min="120" max="900" step="10" value="${n.w || ''}" placeholder="${esc(t('widthAuto'))}" ${S.edit ? '' : 'disabled'}><input type="number" data-r="iH" min="40" max="1200" step="10" value="${n.h || ''}" placeholder="${esc(t('heightAuto'))}" ${S.edit ? '' : 'disabled'}>${S.edit && (n.w || n.h) ? `<button data-r="iWAuto">${t('widthReset')}</button>` : ''}</span></label>
      <label class="chk"><input type="checkbox" data-r="iFlip" ${n.flip ? 'checked' : ''} ${S.edit ? '' : 'disabled'}> ${t('flip')}</label>
      <label class="chk"><input type="checkbox" data-r="iCol" ${n.collapsed ? 'checked' : ''} ${S.edit ? '' : 'disabled'}> ${t('collapse')}</label>
      <h4>${t('pinsH')}</h4>
      ${(pt?.pins || []).map(p => { const c = conns(n.id, p.id); return `<div class="prow" style="--c:${T(p.type).c}"><i class="dot"></i>
        <div><b>${p.num ? esc(p.num) + ' · ' : ''}${esc(p.name)}</b> <small>${busName(T(p.type).bus)}${p.v ? ' ' + esc(p.v) + ' V' : ''}</small>
        <div><small>${esc(loc(p, 'desc') || '')}</small></div>${c.length ? `<div><small>↔ ${c.map(esc).join(', ')}</small></div>` : ''}
        ${p.note ? `<details><summary>${t('details')}</summary><small>${esc(p.note)}</small></details>` : ''}</div></div>`; }).join('')}
      ${cat ? `<p class="muted">${t('catalogPart')}</p>` : ''}
      <div class="btns">${cardUrl(pt) ? `<a class="btnlink" href="${esc(cardUrl(pt))}" target="_blank" rel="noopener noreferrer" title="${esc(t('openCardTitle'))}">${esc(t('openCard'))}</a>` : ''}${S.edit ? `<button class="danger" data-r="iDelNode">${t('delNode')}</button>` : ''}${cat ? '' : `<button data-r="iEditPart">${t('editPart')}</button>`}</div>`;
    if (pt) bindValue(n, pt);
    const li = $('#iLabel');
    if (li) li.oninput = () => { n.label = li.value; delete n.label_en; mark(); const b = nodeEl(n.id)?.querySelector('.nh b'); if (b) b.textContent = nodeLabel(n); drawWires(); };
    const iw = $('#iW'), ih = $('#iH');
    const applySize = () => {
      const q = (el, lo, hi) => { const v = Math.round(+el.value / 10) * 10; return (!el.value || !isFinite(v)) ? null : Math.max(lo, Math.min(hi, v)); };
      const w = q(iw, 120, 900), h = q(ih, 40, 1200);
      if (w === null) delete n.w; else n.w = w;
      if (h === null) delete n.h; else n.h = h;
      mark(); renderCanvas(); renderInsp();
    };
    if (iw) iw.onchange = applySize;
    if (ih) ih.onchange = applySize;
    const iwa = $('#iWAuto'); if (iwa) iwa.onclick = () => { delete n.w; delete n.h; mark(); renderCanvas(); renderInsp(); };
    const ic = $('#iCol'); if (ic) ic.onchange = () => { if (ic.checked) n.collapsed = true; else delete n.collapsed; mark(); renderCanvas(); renderInsp(); };
    const fl = $('#iFlip'); if (fl) fl.onchange = () => { if (fl.checked) n.flip = true; else delete n.flip; mark(); renderCanvas(); renderInsp(); };
    const dn = $('#iDelNode'); if (dn) dn.onclick = delSel;
    const ep = $('#iEditPart'); if (ep) ep.onclick = () => openPart(n.part);
    return;
  }

  if (sel && sel.t === 'link') {
    const l = S.p.links.find(x => x.id === sel.id);
    if (l) {
      const i = info(l), np = (l.pts || []).length;
      el.innerHTML = `<h3>${t('conn')}</h3><div class="prow" style="--c:${i.c}"><i class="dot"></i><div><b>${esc(refName(l.a))}</b> → <b>${esc(refName(l.b))}</b><div><small>${esc(busName(i.bus))}</small></div></div></div>
        ${i.warn.map(w => `<div class="warnbox">⚠ ${esc(w)}</div>`).join('')}
        ${noteInput(l)}
        ${lpControl('link', l.id)}
        <label>${t('style')}<select data-r="iStyle" ${S.edit ? '' : 'disabled'}>
          <option value="">${esc(t('styleDef', t('style.' + (S.p.wire || 'curve'))))}</option>
          ${WIRE_STYLES.map(k => `<option value="${k}"${l.style === k ? ' selected' : ''}>${t('style.' + k)}</option>`).join('')}</select></label>
        <div class="muted" style="margin-top:6px">${t('wpInfo', np)}</div>
        <div class="btns">${S.edit && np ? `<button data-r="iClrPts">${t('clrPts')}</button>` : ''}${S.edit ? `<button class="danger" data-r="iDelLink">${t('delLink')}</button>` : ''}</div>`;
      bindNotes(); bindLp('link', l.id);
      $('#iStyle').onchange = e => { if (e.target.value) l.style = e.target.value; else delete l.style; mark(); drawWires(); };
      const c = $('#iClrPts'); if (c) c.onclick = () => { delete l.pts; mark(); drawWires(); renderInsp(); };
      const d = $('#iDelLink'); if (d) d.onclick = delSel;
      return;
    }
  }

  if (sel && sel.t === 'group') {
    const links = S.p.links.filter(l => groupKey(l) === sel.id);
    if (links.length) {
      const i = info(links[0]);
      el.innerHTML = `<h3>${esc(busName(i.bus))}</h3><div class="muted">${t('groupInfo', links.length, esc(nodeLabel(nodeById(links[0].a.n))), esc(nodeLabel(nodeById(links[0].b.n))))}</div>
        ${links.map(l => `<div class="prow" style="--c:${i.c}"><i class="dot"></i><div><b>${esc(refName(l.a))}</b> → <b>${esc(refName(l.b))}</b></div></div>
          ${info(l).warn.map(w => `<div class="warnbox">⚠ ${esc(w)}</div>`).join('')}${noteInput(l)}`).join('')}
        ${lpControl('group', sel.id)}
        <div class="muted" style="margin-top:6px">${t('wpInfo', (getPts('group', sel.id) || []).length)}</div>
        <div class="btns">${S.edit && (getPts('group', sel.id) || []).length ? `<button data-r="iClrPts">${t('clrPts')}</button>` : ''}${S.edit ? `<button class="danger" data-r="iDelGrp">${t('delAll')}</button>` : ''}</div>`;
      bindNotes(); bindLp('group', sel.id);
      const cp = $('#iClrPts'); if (cp) cp.onclick = () => { setPts('group', sel.id, undefined); mark(); drawWires(); renderInsp(); };
      const d = $('#iDelGrp'); if (d) d.onclick = delSel;
      return;
    }
  }

  if (sel && sel.t === 'note' && noteById(sel.id)) {
    const x = noteById(sel.id), dis = S.edit ? '' : 'disabled';
    el.innerHTML = `<h3>${t('note.title')}</h3>
      <label>${t('note.text')}<textarea data-r="iNote" rows="7" maxlength="${NOTE_MAX}" placeholder="${esc(t('note.ph'))}" ${dis}>${esc(x.text || '')}</textarea></label>
      <label>${t('note.color')}<select data-r="iNoteC" ${dis}>${Object.keys(NOTE_C).map(k => `<option value="${k}"${(x.c || 'note') === k ? ' selected' : ''}>${esc(t('nc.' + k))}</option>`).join('')}</select></label>
      <label>${t('note.width')}<input type="number" data-r="iNoteW" min="80" max="600" step="10" value="${noteW(x)}" ${dis}></label>
      <div class="btns"><button data-r="iCopy">${t('copy')}</button>${S.edit ? `<button class="danger" data-r="iDelNote">${t('note.del')}</button>` : ''}</div>
      <p class="muted">${esc(t('multi.hint'))}</p>`;
    const ta = $('#iNote');
    ta.oninput = () => {
      x.text = ta.value.slice(0, NOTE_MAX); mark();
      const te = itemEl(x.id)?.querySelector('.tn-text');
      if (te) { te.textContent = x.text || t('note.empty'); te.classList.toggle('empty', !x.text); }
      drawWires();
    };
    $('#iNoteC').onchange = e => { if (e.target.value === 'note') delete x.c; else x.c = e.target.value; mark(); renderCanvas(); };
    $('#iNoteW').onchange = e => { const w = Math.max(80, Math.min(600, snap(+e.target.value || 220))); if (w === 220) delete x.w; else x.w = w; mark(); renderCanvas(); renderInsp(); };
    $('#iCopy').onclick = copySel;
    const dn = $('#iDelNote'); if (dn) dn.onclick = delSel;
    return;
  }

  if (sel && sel.t === 'multi' && selIds().length > 1) {
    const ids = selIds(), nn = ids.filter(nodeById).length, dis = S.edit ? '' : ' disabled';
    const b = (k, icon, off) => `<button data-al="${k}" title="${esc(t('al.' + k))}"${dis || (off ? ' disabled' : '')}>${icon} ${esc(t('al.' + k + '.s'))}</button>`;
    el.innerHTML = `<h3>${t('multi.title', ids.length)}</h3><div class="muted">${t('multi.info', nn, ids.length - nn)}</div>
      <h4>${t('align')}</h4><div class="algrid">${b('left', '⇤')}${b('hcenter', '↔')}${b('right', '⇥')}${b('top', '⤒')}${b('vmiddle', '↕')}${b('bottom', '⤓')}</div>
      <h4>${t('distribute')}</h4><div class="algrid two">${b('dh', '⟷', ids.length < 3)}${b('dv', '⇕', ids.length < 3)}</div>
      ${nn && S.edit ? `<div class="btns"><button data-r="iColAll">▸ ${t('col.all')}</button><button data-r="iExpAll">▾ ${t('col.none')}</button></div>` : ''}
      <div class="btns"><button data-r="iCopy">${t('copy')}</button>${S.edit ? `<button class="danger" data-r="iDelSel">${t('delSelected')}</button>` : ''}</div>
      <p class="muted">${esc(t('multi.hint'))}</p>`;
    const colAll = on => { ids.map(nodeById).filter(Boolean).forEach(n => { if (on) n.collapsed = true; else delete n.collapsed; }); mark(); renderCanvas(); renderInsp(); };
    const ca = $('#iColAll'); if (ca) ca.onclick = () => colAll(true);
    const ea = $('#iExpAll'); if (ea) ea.onclick = () => colAll(false);
    el.querySelectorAll('[data-al]').forEach(bt => bt.onclick = () => alignSel(bt.dataset.al));
    $('#iCopy').onclick = copySel;
    const ds = $('#iDelSel'); if (ds) ds.onclick = delSel;
    return;
  }

  const V = validate();
  const issue = (cls, icon, x) => `<div class="${cls}" ${x.link ? `data-goto="${x.link}"` : x.nodes.length ? `data-node="${x.nodes[0]}"` : ''}>${icon} ${esc(x.text)}</div>`;
  el.innerHTML = `<h3>${esc(titleOf(S.p))}</h3>
    <div class="muted">${t('summary', S.p.nodes.length, S.p.links.length)}</div>
    <h4>${t('checkH')}</h4>
    ${V.warns.length ? `<div class="muted">${t('checkWarn')} (${V.warns.length})</div>` + V.warns.map(x => issue('warnbox', '⚠', x)).join('') : ''}
    ${V.hints.length ? `<div class="muted" style="margin-top:8px">${t('checkHints')} (${V.hints.length})</div>` + V.hints.map(x => issue('hintbox', 'ℹ', x)).join('') : ''}
    ${!V.warns.length && !V.hints.length ? `<div class="muted">${t('noIssues')}</div>` : ''}
    <h4>${t('legendH')}</h4>
    ${['power', 'gnd', 'i2c', 'spi', 'uart', 'analog', 'digital', 'pwm', 'control', 'clock']
      .map(b => `<div class="legend" style="--c:${BUSC[b]}"><i></i>${b === 'power' ? t('legend.power') : busName(b)}</div>`).join('')}
    <div class="btns">${S.edit ? `<button class="danger" data-r="iDelProj">${t('delProj')}</button>` : ''}</div>`;
  el.querySelectorAll('[data-goto]').forEach(b => b.onclick = () => { S.mode = 'detail'; S.sel = {t: 'link', id: b.dataset.goto}; render(); });
  el.querySelectorAll('[data-node]').forEach(b => b.onclick = () => { S.sel = {t: 'node', id: b.dataset.node}; render(); });
  const dp = $('#iDelProj'); if (dp) { if (opts.single) dp.hidden = true; else dp.onclick = delProject; }   // ESN: opts.single – jeden schemat (karta projektu)
}

function bindNotes() {
  $$('#insp [data-note]').forEach(i => i.oninput = () => {
    const l = S.p.links.find(x => x.id === i.dataset.note); l.note = i.value; delete l.note_en; mark(); drawWires();
  });
}

/* ------------------------------------------------------------------ akcje */
function select(sel) {
  S.sel = sel;
  const ids = selIds();
  $$('#nodes .node, #nodes .tnote').forEach(e => e.classList.toggle('sel', ids.includes(e.dataset.id)));
  drawWires(); renderInsp();
}

/* ------------------------------------------------------------------ zaznaczanie wielu elementów, notatki, schowek, wyrównywanie
   Zaznaczenie: {t:'node'|'note', id} dla jednego elementu albo {t:'multi', ids:[…]} dla kilku (części i notatki razem). */
const noteById = id => (S.p.notes || []).find(x => x.id === id);
const itemById = id => nodeById(id) || noteById(id);
const itemEl = id => $(`#nodes [data-id="${CSS.escape(id)}"]`);
function selIds() {
  const s = S.sel; if (!s || !S.p) return [];
  if (s.t === 'node' || s.t === 'note') return itemById(s.id) ? [s.id] : [];
  return s.t === 'multi' ? s.ids.filter(itemById) : [];
}
function selFromIds(ids) {                       // 0 → brak, 1 → zwykłe zaznaczenie, więcej → 'multi'
  ids = [...new Set(ids)].filter(id => S.p && itemById(id));
  if (!ids.length) return null;
  if (ids.length === 1) return {t: nodeById(ids[0]) ? 'node' : 'note', id: ids[0]};
  return {t: 'multi', ids};
}
function selectAll() { if (S.p) select(selFromIds([...S.p.nodes.map(n => n.id), ...(S.p.notes || []).map(x => x.id)])); }

/* Notatki: S.p.notes = [{id, x, y, text, c?, w?}] – tekst na płótnie (komentarz), nie wpływa na połączenia ani walidację. */
const NOTE_C = {note: '#ffd23f', info: '#56e1fd', warn: '#ff8c00', ok: '#00ff88'};
const NOTE_MAX = 1000;
const noteW = x => x.w || 220;
function noteHTML(x) {
  const c = NOTE_C[x.c] || NOTE_C.note, sel = selIds().includes(x.id);
  return `<div class="tnote${sel ? ' sel' : ''}" data-id="${esc(x.id)}" style="--c:${c};left:${x.x}px;top:${x.y}px;width:${noteW(x)}px">` +
    `<div class="tn-text${x.text ? '' : ' empty'}">${esc(x.text || t('note.empty'))}</div></div>`;
}
function addNote() {
  if (!S.p || !S.edit) return;
  const vp = $('#vp').getBoundingClientRect(), v = S.view, off = ((S.p.notes || []).length % 6) * 20;
  const x = {id: 't' + uid(), x: snap((vp.width / 2 - v.x) / v.k - 110 + off), y: snap((vp.height / 2 - v.y) / v.k - 30 + off), text: ''};
  (S.p.notes = S.p.notes || []).push(x); mark(); S.sel = {t: 'note', id: x.id}; render();
  const ta = $('#iNote'); if (ta) ta.focus();
}

/* Schowek: localStorage (działa między projektami i kartami tej samej przeglądarki). Kopiowane są zaznaczone części i notatki
   oraz połączenia, których OBA końce są w zaznaczeniu (z opisami, stylem i punktami zaczepienia). */
const CLIP_KEY = 'sch.clip';
function copySel() {
  const ids = selIds(); if (!ids.length) return false;
  const set = new Set(ids), clone = o => JSON.parse(JSON.stringify(o));
  const nodes = S.p.nodes.filter(n => set.has(n.id)).map(clone), notes = (S.p.notes || []).filter(x => set.has(x.id)).map(clone);
  const links = S.p.links.filter(l => set.has(l.a.n) && set.has(l.b.n)).map(clone);
  try { localStorage.setItem(CLIP_KEY, JSON.stringify({v: 1, nodes, links, notes})); } catch (e) { return false; }
  S.pasteN = 0; return true;
}
async function pasteClip(dup) {
  if (!S.p || !S.edit) return;
  let c; try { c = JSON.parse(localStorage.getItem(CLIP_KEY) || 'null'); } catch (e) { c = null; }
  if (!c || (!(c.nodes || []).length && !(c.notes || []).length)) return;
  const items = [...(c.nodes || []), ...(c.notes || [])];
  await ensureParts((c.nodes || []).map(n => n.part));
  // środek wklejanej grupy → środek widoku (kolejne wklejenia przesunięte o 20 px)
  const x0 = Math.min(...items.map(o => +o.x || 0)), y0 = Math.min(...items.map(o => +o.y || 0));
  const x1 = Math.max(...items.map(o => (+o.x || 0) + (o.w || 250))), y1 = Math.max(...items.map(o => (+o.y || 0) + (o.h || 120)));
  const vp = $('#vp').getBoundingClientRect(), v = S.view, k = (S.pasteN = (S.pasteN || 0) + 1) - 1;
  const dx = dup ? 20 * (k + 1) : snap((vp.width / 2 - v.x) / v.k - (x0 + x1) / 2 + k * 20), dy = dup ? 20 * (k + 1) : snap((vp.height / 2 - v.y) / v.k - (y0 + y1) / 2 + k * 20);
  const map = {}, out = [];
  (c.nodes || []).forEach(n => { const m = {...n, id: 'n' + uid(), x: snap(+n.x + dx), y: snap(+n.y + dy)}; map[n.id] = m.id; S.p.nodes.push(m); out.push(m.id); });
  (c.notes || []).forEach(x => { const m = {...x, id: 't' + uid(), x: snap(+x.x + dx), y: snap(+x.y + dy)}; (S.p.notes = S.p.notes || []).push(m); out.push(m.id); });
  (c.links || []).forEach(l => {
    if (!map[l.a.n] || !map[l.b.n]) return;
    const m = {...l, id: 'l' + uid(), a: {n: map[l.a.n], p: l.a.p}, b: {n: map[l.b.n], p: l.b.p}};
    if (m.pts) m.pts = m.pts.map(q => ({x: q.x + dx, y: q.y + dy}));
    S.p.links.push(m);
  });
  normalizeProject(S.p); mark(); S.sel = selFromIds(out); render();
}

/* Wyrównanie i rozkładanie zaznaczonych elementów (rozmiary z DOM, jak w auto-układzie). */
function alignSel(kind) {
  const ids = selIds(); if (ids.length < 2 || !S.edit) return;
  const it = ids.map(id => { const o = itemById(id), e = itemEl(id); return {o, w: e ? e.offsetWidth : 0, h: e ? e.offsetHeight : 0}; });
  const L = Math.min(...it.map(a => a.o.x)), R = Math.max(...it.map(a => a.o.x + a.w)), T = Math.min(...it.map(a => a.o.y)), B = Math.max(...it.map(a => a.o.y + a.h));
  const dist = (pos, size) => {
    if (it.length < 3) return;
    const other = pos === 'x' ? 'y' : 'x';
    const sorted = it.slice().sort((a, b) => a.o[pos] - b.o[pos] || a.o[other] - b.o[other]), first = sorted[0];
    const span = Math.max(...sorted.map(a => a.o[pos] + a[size])) - first.o[pos];
    let gap = (span - sorted.reduce((s2, a) => s2 + a[size], 0)) / (sorted.length - 1);
    if (gap < 0) gap = 40;                         // elementy na siebie nachodzą – ułóż je kolejno z odstępem 40 px
    let cur = first.o[pos];
    sorted.forEach(a => { a.o[pos] = snap(cur); cur += a[size] + gap; });
  };
  it.forEach(a => {
    if (kind === 'left') a.o.x = snap(L); else if (kind === 'right') a.o.x = snap(R - a.w); else if (kind === 'hcenter') a.o.x = snap((L + R) / 2 - a.w / 2);
    else if (kind === 'top') a.o.y = snap(T); else if (kind === 'bottom') a.o.y = snap(B - a.h); else if (kind === 'vmiddle') a.o.y = snap((T + B) / 2 - a.h / 2);
  });
  if (kind === 'dh') dist('x', 'w'); else if (kind === 'dv') dist('y', 'h');
  mark(); renderCanvas(); renderInsp();
}

/* Przesunięcie zaznaczonych o (dx, dy) – strzałki; punkty zaczepienia połączeń wewnątrz zaznaczenia jadą razem z nimi. */
function moveSel(dx, dy) {
  const ids = selIds(); if (!ids.length || !S.edit) return;
  const st = dragStart(ids); dragApply(st, dx, dy); mark(); renderCanvas();
}
function dragStart(ids) {                        // stan początkowy przesuwania grupy
  const set = new Set(ids);
  return {items: ids.map(id => ({o: itemById(id), ox: itemById(id).x, oy: itemById(id).y})),
          pts: S.p.links.filter(l => l.pts && set.has(l.a.n) && set.has(l.b.n)).map(l => ({l, o: l.pts.map(q => ({...q}))})),
          gpts: Object.entries(S.p.gpts || {}).filter(([k]) => { const [a, b] = k.split('|'); return set.has(a) && set.has(b); }).map(([k, v]) => ({k, o: v.map(q => ({...q}))}))};
}
function dragApply(st, dx, dy) {
  st.items.forEach(a => { a.o.x = snap(a.ox + dx); a.o.y = snap(a.oy + dy); const e = itemEl(a.o.id); if (e) { e.style.left = a.o.x + 'px'; e.style.top = a.o.y + 'px'; } });
  const ddx = st.items.length ? st.items[0].o.x - st.items[0].ox : 0, ddy = st.items.length ? st.items[0].o.y - st.items[0].oy : 0;
  st.pts.forEach(a => { a.l.pts = a.o.map(q => ({x: q.x + ddx, y: q.y + ddy})); });
  st.gpts.forEach(a => { S.p.gpts[a.k] = a.o.map(q => ({x: q.x + ddx, y: q.y + ddy})); });
}

async function addNode(partId) {
  if (!S.p || !S.edit) return;
  await ensureParts([partId]); if (!S.parts[partId]) return;
  const vp = $('#vp').getBoundingClientRect(), v = S.view, off = (S.p.nodes.length % 6) * 20;
  const n = {id: 'n' + uid(), part: partId, label: '', x: snap((vp.width / 2 - v.x) / v.k - 125 + off), y: snap((vp.height / 2 - v.y) / v.k - 60 + off)};
  S.p.nodes.push(n); mark(); S.sel = {t: 'node', id: n.id}; render();
}

const same = (x, y) => x.n === y.n && x.p === y.p;
function addLink(a, b) {
  if (S.p.links.some(l => (same(l.a, a) && same(l.b, b)) || (same(l.a, b) && same(l.b, a)))) return;
  const l = {id: 'l' + uid(), a, b, note: ''};
  S.p.links.push(l); mark(); S.sel = {t: 'link', id: l.id}; render();
}

function delSel() {
  const s = S.sel; if (!s || !S.edit) return;
  if (s.t === 'node') {
    S.p.nodes = S.p.nodes.filter(n => n.id !== s.id);
    S.p.links = S.p.links.filter(l => l.a.n !== s.id && l.b.n !== s.id);
  } else if (s.t === 'link') {
    S.p.links = S.p.links.filter(l => l.id !== s.id);
  } else if (s.t === 'group') {
    S.p.links = S.p.links.filter(l => groupKey(l) !== s.id);
  } else if (s.t === 'note' || s.t === 'multi') {
    const set = new Set(selIds());
    S.p.nodes = S.p.nodes.filter(n => !set.has(n.id));
    S.p.links = S.p.links.filter(l => !set.has(l.a.n) && !set.has(l.b.n));
    if (S.p.notes) { S.p.notes = S.p.notes.filter(x => !set.has(x.id)); if (!S.p.notes.length) delete S.p.notes; }
  }
  S.sel = null; mark(); render();
}

function autoLayout() {
  if (!S.p || !S.edit) return;
  const gap = S.mode === 'detail' ? 160 : 120;
  const cols = [0, 1, 2, 3, 4].map(i => S.p.nodes.filter(n => (LAYOUT_COL[partOf(n)?.category] ?? 4) === i)).filter(a => a.length);
  let x = 40;
  for (const col of cols) {
    let y = 40, w = 0;
    for (const n of col) {
      const e = nodeEl(n.id);
      n.x = x; n.y = y; y += snap(e.offsetHeight + 40); w = Math.max(w, e.offsetWidth);
    }
    x += w + gap;
  }
  S.p.links.forEach(l => delete l.pts);          // stare punkty zaczepienia przestają pasować po zmianie układu
  delete S.p.gpts;
  mark(); renderCanvas(); fit();
}

function fit() {
  const ns = [...$$('#nodes .node, #nodes .tnote')]; if (!ns.length) return;
  const vp = $('#vp').getBoundingClientRect();
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  ns.forEach(e => { x0 = Math.min(x0, e.offsetLeft); y0 = Math.min(y0, e.offsetTop); x1 = Math.max(x1, e.offsetLeft + e.offsetWidth); y1 = Math.max(y1, e.offsetTop + e.offsetHeight); });
  const k = Math.min(1.2, Math.max(.3, Math.min((vp.width - 80) / (x1 - x0), (vp.height - 80) / (y1 - y0))));
  S.view = {k, x: (vp.width - (x1 - x0) * k) / 2 - x0 * k, y: (vp.height - (y1 - y0) * k) / 2 - y0 * k};
  applyView();
}

/* ------------------------------------------------------------------ mysz */
const vpPoint = e => { const r = $('#vp').getBoundingClientRect(), v = S.view; return {x: (e.clientX - r.left - v.x) / v.k, y: (e.clientY - r.top - v.y) / v.k}; };
const DBL = 400;   // ms – okno dwukliku (własna detekcja: DOM jest przebudowywany po pierwszym kliknięciu, więc natywny dblclick zawodzi)

/* ------------------------------------------------------------------ wskaźniki (etap 9b): mysz, palec i rysik przez Pointer Events
   Jeden palec działa jak mysz (przesuwanie tła, części, łączenie pinów…), dwa palce = przesuwanie i powiększanie,
   przytrzymanie palca na tle (0,5 s) = zaznaczanie ramką (odpowiednik Shift+przeciągnięcia). */
const PT = new Map();                                              // aktywne palce/rysiki na płótnie: pointerId → {x, y}
const LONG_MS = 500, TAP_PX = 8;
function startPinch() {
  const d = S.drag;
  if (d) {                                                         // drugi palec przerywa bieżący gest pierwszego
    if (d.lp) clearTimeout(d.lp);
    if (d.t === 'box' && d.el) d.el.remove();
    if (d.t === 'link') { const tmp = $('#tmp'); if (tmp) tmp.remove(); }
    if (d.moved && ['node', 'multi', 'resize', 'wp', 'label'].includes(d.t)) mark();
  }
  const [a, b] = [...PT.values()], r = $('#vp').getBoundingClientRect();
  const mid = {x: (a.x + b.x) / 2 - r.left, y: (a.y + b.y) / 2 - r.top};
  S.drag = {t: 'pinch', dist0: Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)), view0: {...S.view},
            w0: {x: (mid.x - S.view.x) / S.view.k, y: (mid.y - S.view.y) / S.view.k}};
  $('#vp').classList.remove('panning');
}
function movePinch() {
  const d = S.drag, [a, b] = [...PT.values()], r = $('#vp').getBoundingClientRect();
  const mid = {x: (a.x + b.x) / 2 - r.left, y: (a.y + b.y) / 2 - r.top};
  const k = Math.min(2, Math.max(.25, d.view0.k * Math.hypot(a.x - b.x, a.y - b.y) / d.dist0));
  S.view = {k, x: mid.x - d.w0.x * k, y: mid.y - d.w0.y * k};     // punkt pod środkiem palców zostaje pod palcami
  applyView();
}
function longPress(x, y, pid) {                                    // przytrzymanie palca na tle → ramka zaznaczenia
  const d = S.drag; if (!d || d.t !== 'pan' || d.pid !== pid) return;
  const p0 = vpPoint({clientX: x, clientY: y}), box = document.createElement('div');
  box.className = 'selbox'; $('#world').appendChild(box);
  $('#vp').classList.remove('panning');
  S.drag = {t: 'box', p0, base: selIds(), el: box, pid};
  if (navigator.vibrate) { try { navigator.vibrate(15); } catch (e) { /* brak wibracji */ } }
}
$('#vp').addEventListener('pointerdown', e => {
  if (e.pointerType !== 'mouse') {
    PT.set(e.pointerId, {x: e.clientX, y: e.clientY});
    if (PT.size === 2) { startPinch(); e.preventDefault(); return; }
    if (PT.size > 2) return;
  }
  onDown(e);
  const d = S.drag; if (!d || d.pid !== undefined) return;
  d.pid = e.pointerId;
  if (d.t === 'pan' && e.pointerType !== 'mouse') d.lp = setTimeout(() => longPress(e.clientX, e.clientY, e.pointerId), LONG_MS);
});
function onDown(e) {
  if (e.button !== 0) return;
  if (e.target.closest('a.nlink')) return;                         // link do karty komponentu – zwykłe kliknięcie linku
  const colB = e.target.closest('.ncol');
  if (colB) {                                                       // ▾ / ▸ – zwiń albo rozwiń kafelek
    const n = nodeById(colB.closest('.node').dataset.id);
    if (n && S.edit) { if (n.collapsed) delete n.collapsed; else n.collapsed = true; mark(); renderCanvas(); renderInsp(); }
    e.preventDefault(); e.stopPropagation(); return;
  }
  const rt = S.sel && (S.sel.t === 'link' || S.sel.t === 'group') ? {ty: S.sel.t, key: S.sel.id} : null;     // zaznaczona trasa (połączenie / grupa)
  const ghost = e.target.closest('.wp.ghost');
  if (ghost && rt) {                                               // przeciągnięcie „ducha" = nowy punkt zaczepienia
    const pts = (getPts(rt.ty, rt.key) || []).slice(), i = +ghost.dataset.seg;
    pts.splice(i, 0, {x: snap(+ghost.dataset.x), y: snap(+ghost.dataset.y)});
    setPts(rt.ty, rt.key, pts);
    S.drag = {t: 'wp', ty: rt.ty, key: rt.key, i, moved: true};
    drawWires(); renderInsp(); e.preventDefault(); return;
  }
  const wp = e.target.closest('.wp');
  if (wp && rt) {
    const i = +wp.dataset.wp, now = Date.now();
    if (S.last.wp === i && S.last.key === rt.key && now - S.last.t < DBL) {      // dwuklik = usuń punkt
      const pts = (getPts(rt.ty, rt.key) || []).slice(); pts.splice(i, 1); setPts(rt.ty, rt.key, pts);
      S.last = {}; mark(); drawWires(); renderInsp(); e.preventDefault(); return;
    }
    S.last = {wp: i, key: rt.key, t: now};
    S.drag = {t: 'wp', ty: rt.ty, key: rt.key, i, moved: false}; e.preventDefault(); return;
  }
  /* Dwuklik na przewodzie lub etykiecie = nowy punkt zaczepienia. Wykrywamy go w mousedown (nie w click): pierwsze kliknięcie
     zaznacza trasę i przebudowuje widok, więc zdarzenie click drugiego kliknięcia często w ogóle nie nadchodzi
     (w widoku uproszczonym etykieta zawsze leży na przewodzie). */
  const edgeEl = e.target.closest('[data-e]');
  if (edgeEl) {
    const key = edgeEl.dataset.e, ty = edgeEl.dataset.t, now = Date.now(), L = S.last;
    const dbl = L.edge === key && now - L.t < DBL && Math.hypot(e.clientX - L.x, e.clientY - L.y) < 12;
    S.last = {edge: key, t: now, x: e.clientX, y: e.clientY};
    if (dbl && canAddPoint(ty) && addPointAt(ty, key, e)) { S.last = {}; select({t: ty, id: key}); e.preventDefault(); return; }
  }
  const lb = e.target.closest('.elabel');
  if (lb && S.edit && S.geo[lb.dataset.e]) {                      // etykieta: przeciąganie wzdłuż przewodu
    select({t: lb.dataset.t, id: lb.dataset.e});
    S.drag = {t: 'label', key: lb.dataset.e, ty: lb.dataset.t, moved: false, sx: e.clientX, sy: e.clientY};
    e.preventDefault(); return;
  }
  if (edgeEl) {                                                    // przewód: zaznaczenie przy puszczeniu bez ruchu (mysz i dotyk;
    S.drag = {t: 'edgetap', key: edgeEl.dataset.e, ty: edgeEl.dataset.t, sx: e.clientX, sy: e.clientY};   // 'click' po tapnięciu bywa wstrzymywany)
    return;
  }
  const rz = e.target.closest('.rsz, .rsz-r, .rsz-b');
  if (rz && S.edit) {                                                   // zmiana rozmiaru kafelka (oś x, y lub obie)
    const ne = rz.closest('.node'), n = nodeById(ne.dataset.id);
    select({t: 'node', id: n.id});
    S.drag = {t: 'resize', ax: rz.dataset.ax, n, el: ne, sx: e.clientX, sy: e.clientY, w0: ne.offsetWidth, h0: ne.offsetHeight, moved: false};
    e.preventDefault(); return;
  }
  const pin = e.target.closest('.pin'), node = e.target.closest('.node');
  if (pin && S.mode === 'detail' && S.edit) {
    const ne = pin.closest('.node');
    S.drag = {t: 'link', from: {n: ne.dataset.id, p: pin.dataset.p}};
    select({t: 'node', id: ne.dataset.id});
    e.preventDefault(); return;
  }
  const tn = e.target.closest('.tnote');
  if (node || tn) {
    const id = (node || tn).dataset.id, ids = selIds();
    if (e.shiftKey || e.ctrlKey || e.metaKey) {                // Shift/Ctrl+klik: dodaj do zaznaczenia albo z niego usuń
      select(selFromIds(ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]));
      e.preventDefault(); return;
    }
    if (ids.length > 1 && ids.includes(id)) {                   // przeciąganie całego zaznaczenia
      if (S.edit) S.drag = {t: 'multi', st: dragStart(ids), sx: e.clientX, sy: e.clientY, moved: false, id, keep: true};
      e.preventDefault(); return;
    }
    if (tn) {
      select({t: 'note', id});
      if (S.edit) S.drag = {t: 'multi', st: dragStart([id]), sx: e.clientX, sy: e.clientY, moved: false, id};
      e.preventDefault(); return;
    }
    const n = nodeById(id);
    select({t: 'node', id: n.id});
    if (S.edit) S.drag = {t: 'node', n, el: node, sx: e.clientX, sy: e.clientY, ox: n.x, oy: n.y, moved: false};
    e.preventDefault(); return;
  }
  if (e.shiftKey) {                                               // Shift+przeciągnięcie tła: zaznaczanie ramką
    const p0 = vpPoint(e), box = document.createElement('div');
    box.className = 'selbox'; $('#world').appendChild(box);
    S.drag = {t: 'box', p0, base: selIds(), el: box};
    e.preventDefault(); return;
  }
  S.drag = {t: 'pan', sx: e.clientX, sy: e.clientY, ox: S.view.x, oy: S.view.y, moved: false};
  $('#vp').classList.add('panning');
}

on(window, 'pointermove', e => {
  if (PT.has(e.pointerId)) PT.set(e.pointerId, {x: e.clientX, y: e.clientY});
  const d = S.drag; if (!d) return;
  if (d.t === 'pinch') { if (PT.size >= 2) movePinch(); return; }
  if (d.pid !== undefined && e.pointerId !== d.pid) return;        // inny palec niż ten, który zaczął gest
  if (d.t === 'pan') {
    const far = Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > (e.pointerType === 'mouse' ? 2 : TAP_PX);
    if (d.lp && far) { clearTimeout(d.lp); d.lp = null; }
    if (far) d.moved = true;
    S.view.x = d.ox + e.clientX - d.sx; S.view.y = d.oy + e.clientY - d.sy; applyView();
  } else if (d.t === 'multi') {
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 3) return;
    d.moved = true; dragApply(d.st, (e.clientX - d.sx) / S.view.k, (e.clientY - d.sy) / S.view.k); drawWires();
  } else if (d.t === 'box') {
    const m = vpPoint(e), x = Math.min(m.x, d.p0.x), y = Math.min(m.y, d.p0.y), w = Math.abs(m.x - d.p0.x), h = Math.abs(m.y - d.p0.y);
    Object.assign(d.el.style, {left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px'}); d.r = {x, y, w, h};
  } else if (d.t === 'node') {
    d.moved = true;
    d.n.x = snap(d.ox + (e.clientX - d.sx) / S.view.k); d.n.y = snap(d.oy + (e.clientY - d.sy) / S.view.k);
    d.el.style.left = d.n.x + 'px'; d.el.style.top = d.n.y + 'px';
    drawWires();
  } else if (d.t === 'resize') {
    d.moved = true;
    if (d.ax.includes('x')) { d.n.w = Math.max(120, Math.min(900, snap(d.w0 + (e.clientX - d.sx) / S.view.k))); d.el.style.width = d.n.w + 'px'; d.el.classList.add('sized'); }
    if (d.ax.includes('y')) { d.n.h = Math.max(40, Math.min(1200, snap(d.h0 + (e.clientY - d.sy) / S.view.k))); d.el.style.minHeight = d.n.h + 'px'; }
    drawWires();
  } else if (d.t === 'label') {
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 3) return;
    const g = S.geo[d.key]; if (!g) return;
    d.moved = true;
    setLp(d.ty, d.key, Math.round(nearestT(g.pts, g.info, vpPoint(e)) * 1000) / 1000);
    drawWires();
  } else if (d.t === 'wp') {
    const m = vpPoint(e), pts = getPts(d.ty, d.key); d.moved = true;
    if (pts && pts[d.i]) pts[d.i] = {x: snap(m.x), y: snap(m.y)};
    drawWires();
  } else if (d.t === 'link') {
    const ne = nodeEl(d.from.n), pe = [...ne.querySelectorAll('.pin')].find(x => x.dataset.p === d.from.p);
    const wr = $('#world').getBoundingClientRect(), k = S.view.k, r = pe.querySelector('.dot').getBoundingClientRect();
    const p1 = {x: (r.left + r.width / 2 - wr.left) / k, y: (r.top + r.height / 2 - wr.top) / k, d: pe.classList.contains('L') ? -1 : 1};
    const m = vpPoint(e);
    let tmp = $('#tmp');
    if (!tmp) { $('#wires').insertAdjacentHTML('beforeend', '<path data-r="tmp" class="w" style="--c:#56e1fd;stroke-dasharray:3 4"/>'); tmp = $('#tmp'); }
    tmp.setAttribute('d', route(p1, {x: m.x, y: m.y, d: -p1.d}, [], S.p.wire || 'curve').d);
  }
});

function onUp(e) {
  PT.delete(e.pointerId);
  const d = S.drag; if (!d) return;
  if (d.t === 'pinch') { if (PT.size < 2) S.drag = null; return; } // koniec gestu dwoma palcami (bez wznawiania przesuwania)
  if (d.pid !== undefined && e.pointerId !== d.pid) return;
  if (d.lp) clearTimeout(d.lp);
  if (e.type === 'pointercancel') {                                // przeglądarka przejęła gest – sprzątamy bez akcji
    S.drag = null; $('#vp').classList.remove('panning');
    if (d.el) d.el.remove(); const tmp = $('#tmp'); if (tmp) tmp.remove();
    if (d.moved) { mark(); renderCanvas(); }
    return;
  }
  S.drag = null; $('#vp').classList.remove('panning');
  if (d.t === 'pan' && !d.moved) select(null);
  if (d.t === 'edgetap' && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) <= TAP_PX) select({t: d.ty, id: d.key});
  if (d.moved && ['node', 'multi', 'resize', 'wp', 'label'].includes(d.t)) drawWires();   // etykiety z omijaniem przewodów po zakończeniu ruchu
  if (d.t === 'multi') {
    if (d.moved) { mark(); if (S.mode === 'detail' && S.p.orient === 'auto') renderCanvas(); }
    else if (d.keep) select(selFromIds([d.id]));                 // klik bez ruchu na elemencie zaznaczenia = zaznacz tylko jego
  }
  if (d.t === 'box') {
    d.el.remove();
    if (d.r && d.r.w > 2 && d.r.h > 2) {
      const R = d.r, hits = [...$$('#nodes .node, #nodes .tnote')].filter(el =>
        el.offsetLeft < R.x + R.w && el.offsetLeft + el.offsetWidth > R.x && el.offsetTop < R.y + R.h && el.offsetTop + el.offsetHeight > R.y).map(el => el.dataset.id);
      select(selFromIds([...d.base, ...hits]));
    }
  }
  if ((d.t === 'node' || d.t === 'wp' || d.t === 'label') && d.moved) { mark(); if (d.t === 'label') renderInsp(); }
  if (d.t === 'resize' && d.moved) { mark(); if (S.mode === 'detail' && S.p.orient === 'auto') renderCanvas(); renderInsp(); }
  if (d.t === 'node' && d.moved && S.mode === 'detail' && S.p.orient === 'auto') renderCanvas();
  if (d.t === 'link') {
    const tmp = $('#tmp'); if (tmp) tmp.remove();
    const el = document.elementFromPoint(e.clientX, e.clientY), pin = el && el.closest('.pin'), ne = pin && pin.closest('.node');
    if (pin && ne && ne.dataset.id !== d.from.n) addLink(d.from, {n: ne.dataset.id, p: pin.dataset.p});
  }
}
on(window, 'pointerup', onUp);
on(window, 'pointercancel', onUp);

/* dwuklik na przewodzie = nowy punkt zaczepienia w najbliższym odcinku (własna detekcja dwukliku) */
function distSeg(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1;
  const u = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  return Math.hypot(p.x - (a.x + u * dx), p.y - (a.y + u * dy));
}
function canAddPoint(ty) { return S.edit && ((ty === 'link' && S.mode === 'detail') || (ty === 'group' && S.mode === 'simple')); }
function addPointAt(ty, key, e) {                          // nowy punkt zaczepienia w najbliższym odcinku trasy
  const geo = S.geo[key]; if (!geo) return false;
  const m = vpPoint(e), pts = (getPts(ty, key) || []).slice();
  const seq = [geo.p1, ...pts, geo.p2];
  let best = 0, bd = 1e9;
  for (let i = 0; i < seq.length - 1; i++) { const dd = distSeg(m, seq[i], seq[i + 1]); if (dd < bd) { bd = dd; best = i; } }
  pts.splice(best, 0, {x: snap(m.x), y: snap(m.y)});
  setPts(ty, key, pts); mark();
  return true;
}

$('#vp').addEventListener('wheel', e => {
  e.preventDefault();
  const r = $('#vp').getBoundingClientRect(), v = S.view, k2 = Math.min(2, Math.max(.25, v.k * (e.deltaY < 0 ? 1.1 : .9)));
  const mx = e.clientX - r.left, my = e.clientY - r.top;
  v.x = mx - (mx - v.x) * (k2 / v.k); v.y = my - (my - v.y) * (k2 / v.k); v.k = k2; applyView();
}, {passive: false});

on(window, 'keydown', e => {
  if (ACTIVE !== inst || !root.offsetHeight || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || root.querySelector('dialog[open]')) return;
  const mod = e.ctrlKey || e.metaKey, key = e.key.toLowerCase();
  const ARROWS = {arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1]};
  if (key === 'delete' || key === 'backspace') { delSel(); e.preventDefault(); }
  else if (mod && key === 'a') { e.preventDefault(); selectAll(); }
  else if (mod && key === 'c') { if (copySel()) e.preventDefault(); }
  else if (mod && key === 'x') { if (S.edit && copySel()) { e.preventDefault(); delSel(); } }
  else if (mod && key === 'v') { e.preventDefault(); pasteClip(); }
  else if (mod && key === 'd') { e.preventDefault(); if (S.edit && copySel()) pasteClip(true); }
  else if (key === 'escape') { if (S.sel) select(null); }
  else if (ARROWS[key] && !mod && selIds().length && S.edit) { e.preventDefault(); const st = e.shiftKey ? 50 : 10; moveSel(ARROWS[key][0] * st, ARROWS[key][1] * st); }
  else if (mod && key === 's') { e.preventDefault(); saveProject(); }
  else if (mod && key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
  else if (mod && (key === 'y' || (key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
});

/* ------------------------------------------------------------------ biblioteka części + dialog */
$('#libQ').oninput = () => { clearTimeout(libTimer); libTimer = setTimeout(() => loadLib(true), 250); };
$('#libSeg').onclick = e => { const b = e.target.closest('button'); if (b) { S.libSrc = b.dataset.s; renderTop(); loadLib(true); } };
$('#libList').addEventListener('click', e => {
  if (e.target.closest('[data-r="libMore"]')) { loadLib(false); return; }
  const ed = e.target.closest('[data-ed]');
  if (ed) { e.stopPropagation(); openPart(ed.dataset.ed); return; }
  const it = e.target.closest('[data-add]'); if (it) addNode(it.dataset.add);
});
$('#btnPart').onclick = () => openPart(null);

let editingPart = null;
async function openPart(id) {
  if (id) await ensureParts([id]);
  editingPart = id; const p = id && S.parts[id];
  if (p && p.source === 'catalog') return;
  $('#dlgTitle').textContent = t(p ? 'part.edit' : 'part.new');
  $('#pName').value = p ? p.name : ''; $('#pCat').value = p ? p.category : 'Inne'; $('#pDesc').value = p ? p.desc || '' : '';
  $('#pIcon').value = p && p.icon ? p.icon : ''; $('#pImage').value = p && p.image ? p.image : '';
  $('#pPins').value = p ? p.pins.map(x => [x.name, x.type, x.desc || '', x.v || '', x.side || ''].join(' | ').replace(/( \| )+$/, '')).join('\n') : '';
  $('#pTypes').textContent = t('part.types') + Object.keys(TYPES).join(', ');
  $('#dlg').showModal();
}
function parsePins(text, old) {
  const seen = new Set(), oldBy = new Map((old || []).map(p => [p.id, p]));
  return text.split('\n').map(s => s.trim()).filter(Boolean).map(line => {
    const [n, ty, d, v, s] = line.split('|').map(x => x.trim());
    let id = n, i = 2; while (seen.has(id)) id = n + '_' + i++;
    seen.add(id);
    const o = {id, name: n, type: TYPES[ty] ? ty : 'digital', desc: d || ''};
    const prev = oldBy.get(id);
    if (prev && prev.desc_en && prev.desc === o.desc) o.desc_en = prev.desc_en;       // zachowaj tłumaczenie, jeśli opis się nie zmienił
    if (v) o.v = v;
    if (s && /^[LR]$/i.test(s)) o.side = s.toUpperCase();
    return o;
  });
}
$('#pCancel').onclick = () => $('#dlg').close();
$('#pSave').onclick = async () => {
  const name = $('#pName').value.trim(); if (!name) { $('#pName').focus(); return; }
  const old = editingPart && S.parts[editingPart];
  const id = editingPart || (name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'part') + '-' + uid().slice(0, 3);
  const part = {id, name, category: $('#pCat').value, desc: $('#pDesc').value.trim(), pins: parsePins($('#pPins').value, old && old.pins)};
  if ($('#pIcon').value) part.icon = $('#pIcon').value;
  const img = $('#pImage').value.trim(); if (/^(https?:\/\/|\/)/.test(img)) part.image = img;          // tylko adresy http(s) lub ścieżki na serwerze
  if (old && old.name_en && old.name === name) part.name_en = old.name_en;
  if (old && old.desc_en && old.desc === part.desc) part.desc_en = old.desc_en;
  await api('PUT', '/parts/' + encodeURIComponent(id), part);
  S.parts[id] = part; $('#dlg').close(); await loadLib(true); render();
};

/* ------------------------------------------------------------------ projekty */
async function loadProjects(pick) {
  S.projects = await api('GET', '/projects');
  const id = pick || (S.p && S.p.id) || (S.projects[0] && S.projects[0].id);
  if (id) await openProject(id, true); else { S.p = null; render(); }
}
/* Naprawia projekt z zewnątrz (import JSON, schemat wygenerowany przez AI): brakujące id i pozycje, złe typy,
   połączenia do nieistniejących części. Zwraca {changed, needLayout}. */
function normalizeProject(p) {
  let changed = false, needLayout = false;
  if (!Array.isArray(p.nodes)) { p.nodes = []; changed = true; }
  if (!Array.isArray(p.links)) { p.links = []; changed = true; }
  const n0 = p.nodes.length, l0 = p.links.length, ids = new Set();
  p.nodes = p.nodes.filter(n => n && n.part);
  p.nodes.forEach((n, i) => {
    if (n.id == null || ids.has(String(n.id))) { n.id = 'n' + uid(); changed = true; }
    n.id = String(n.id); ids.add(n.id);
    if (!isFinite(n.x) || !isFinite(n.y) || n.x === null || n.y === null) { n.x = 40 + (i % 3) * 520; n.y = 40 + Math.floor(i / 3) * 360; needLayout = changed = true; }
    n.x = +n.x; n.y = +n.y;
    if (typeof n.label !== 'string') n.label = '';
    if (n.value !== undefined) { if (typeof n.value === 'string' && n.value.trim()) n.value = n.value.trim().slice(0, VAL_MAX); else delete n.value; }
    if (n.flip !== undefined && n.flip !== true) delete n.flip;
    if (n.collapsed !== undefined && n.collapsed !== true) delete n.collapsed;
    if (n.w !== undefined) { if (isFinite(n.w) && n.w >= 120 && n.w <= 900) n.w = +n.w; else delete n.w; }
    if (n.h !== undefined) { if (isFinite(n.h) && n.h >= 40 && n.h <= 1200) n.h = +n.h; else delete n.h; }
  });
  if (p.density !== undefined && p.density !== 'compact') delete p.density;
  if (p.orient !== undefined && !['def', 'auto'].includes(p.orient)) delete p.orient;
  p.links = p.links.filter(l => l && l.a && l.b && l.a.p != null && l.b.p != null && ids.has(String(l.a.n)) && ids.has(String(l.b.n)));
  const lids = new Set();
  p.links.forEach(l => {
    l.a = {n: String(l.a.n), p: String(l.a.p)}; l.b = {n: String(l.b.n), p: String(l.b.p)};
    if (l.id == null || lids.has(String(l.id))) { l.id = 'l' + uid(); changed = true; }
    l.id = String(l.id); lids.add(l.id);
    if (typeof l.note !== 'string') l.note = '';
    if (l.pts !== undefined) { l.pts = Array.isArray(l.pts) ? l.pts.filter(q => q && isFinite(q.x) && isFinite(q.y)).map(q => ({x: +q.x, y: +q.y})) : []; if (!l.pts.length) delete l.pts; }
    if (l.style && !WIRE_STYLES.includes(l.style)) delete l.style;
    if (l.lp !== undefined && !((typeof l.lp === 'number' && l.lp >= 0 && l.lp <= 1) || l.lp === 'mid' || l.lp === 'longest')) delete l.lp;
  });
  if (p.notes !== undefined) {
    const nids = new Set();
    p.notes = Array.isArray(p.notes) ? p.notes.filter(x => x && isFinite(x.x) && isFinite(x.y)).map(x => {
      const o = {id: x.id == null || nids.has(String(x.id)) || ids.has(String(x.id)) ? 't' + uid() : String(x.id), x: +x.x, y: +x.y,
                 text: typeof x.text === 'string' ? x.text.slice(0, NOTE_MAX) : ''};
      nids.add(o.id);
      if (NOTE_C[x.c] && x.c !== 'note') o.c = x.c;
      if (isFinite(x.w) && x.w >= 80 && x.w <= 600) o.w = +x.w;
      return o;
    }) : [];
    if (!p.notes.length) delete p.notes;
  }
  if (p.glabels && (typeof p.glabels !== 'object' || Array.isArray(p.glabels))) delete p.glabels;
  if (p.gpts) {
    if (typeof p.gpts !== 'object' || Array.isArray(p.gpts)) delete p.gpts;
    else {
      Object.keys(p.gpts).forEach(k => {
        const a = p.gpts[k];
        p.gpts[k] = Array.isArray(a) ? a.filter(q => q && isFinite(q.x) && isFinite(q.y)).map(q => ({x: +q.x, y: +q.y})) : [];
        if (!p.gpts[k].length) delete p.gpts[k];
      });
      if (!Object.keys(p.gpts).length) delete p.gpts;
    }
  }
  if (!WIRE_STYLES.includes(p.wire)) { p.wire = 'curve'; changed = true; }
  if (p.nodes.length !== n0 || p.links.length !== l0) changed = true;
  return {changed, needLayout};
}

async function openProject(id, force) {
  if (!force && S.dirty && !confirm(t('confirm.discard'))) { $('#projSel').value = S.p.id; return; }
  S.p = await api('GET', '/projects/' + id);
  S.meta = {rev: S.p.rev, can_edit: S.p.can_edit, project_id: S.p.project_id};   // ESN: dane serwera trzymane poza projektem
  ['rev', 'can_edit', 'project_id'].forEach(k => delete S.p[k]);                 // (cofanie/eksport JSON ich nie dotykają)
  const norm = normalizeProject(S.p);
  await ensureParts(S.p.nodes.map(n => n.part));
  S.sel = null; S.dirty = false; $('#dirty').textContent = '';
  histReset(); render(); fit();
  if (norm.needLayout && S.edit) autoLayout();                 // schemat bez pozycji (np. z AI) – rozmieść części
  else if (norm.changed) mark();
}
async function saveProject() {
  if (!S.p) return;
  if (H.timer) commit();
  let res;
  try { res = await api('PUT', '/projects/' + S.p.id, {...S.p, rev: S.meta && S.meta.rev}); }   // ESN: rev = blokada optymistyczna
  catch (e) {
    if (e.status === 409) return saveConflict();
    $('#dirty').textContent = t('saveErr', errText(e)); return;
  }
  if (res && res.rev != null) S.meta = {...(S.meta || {}), rev: res.rev};
  S.dirty = false; $('#dirty').textContent = t('saved');
  S.projects = await api('GET', '/projects'); renderTop();
  setTimeout(() => { if (!S.dirty) $('#dirty').textContent = ''; }, 1500);
}
/* ESN: ktoś zapisał nowszą wersję (409) – wczytaj ją albo zapisz bieżącą jako kopię (README 10.2) */
async function saveConflict() {
  if (confirm(t('conflict.ask'))) { S.dirty = false; await openProject(S.p.id, true); return; }
  const copy = JSON.parse(snapshot());
  delete copy.id; delete copy.title_en; copy.title = ((copy.title || '') + ' ' + t('conflict.copy')).trim();
  try { const p = await api('POST', '/projects', copy); S.dirty = false; await loadProjects(p.id); }
  catch (e) { $('#dirty').textContent = t('saveErr', errText(e)); }
}
async function delProject() {
  if (!confirm(t('confirm.delProj'))) return;
  await api('DELETE', '/projects/' + S.p.id); S.dirty = false; S.p = null; await loadProjects();
}

$('#projSel').onchange = e => openProject(e.target.value);
$('#projTitle').oninput = e => { if (S.p) { S.p.title = e.target.value; delete S.p.title_en; mark(); } };
$('#wireSel').onchange = e => { if (S.p) { S.p.wire = e.target.value; mark(); drawWires(); renderInsp(); } };
$('#btnNew').onclick = async () => { const p = await api('POST', '/projects', {title: t('newProjectTitle')}); S.dirty = false; await loadProjects(p.id); };
$('#btnSave').onclick = saveProject;
$('#btnUndo').onclick = undo;
$('#btnRedo').onclick = redo;
$('#btnLayout').onclick = autoLayout;
$('#btnNote').onclick = addNote;
$('#btnFit').onclick = fit;
$('#editChk').onchange = e => { S.edit = e.target.checked; render(); };
$('#modeSeg').onclick = e => { const b = e.target.closest('button'); if (b) { S.mode = b.dataset.m; S.sel = null; render(); } };
function setLang(l) {
  if (!I18N[l]) return;
  LANG = l; try { localStorage.setItem('sch.lang', LANG); } catch (e) { /* tryb prywatny */ }
  applyStatic(); updUndo(); if ($('#dirty').textContent) $('#dirty').textContent = S.dirty ? t('dirty') : '';
  S.projects = S.projects.slice(); render();
}
$('#langSel').onchange = e => setLang(e.target.value);

/* ------------------------------------------------------------------ eksport (JSON / SVG / PNG) */
function download(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}
const fname = ext => ((titleOf(S.p) || 'schemat').replace(/[^\w-]+/g, '_')) + '_' + S.mode + '.' + ext;

function exportJson() {
  const used = {}; S.p.nodes.forEach(n => { const pt = S.parts[n.part]; if (pt && pt.source !== 'catalog') used[n.part] = pt; });
  download(new Blob([JSON.stringify({project: S.p, parts: used}, null, 1)], {type: 'application/json'}), fname('json'));
}

/* Obraz budowany z aktualnego widoku (uproszczony / szczegółowy, aktualny język): węzły są elementami HTML,
   więc rysujemy je ręcznie jako SVG na podstawie położenia elementów w DOM. */
async function toDataUrl(u) {                 // zdjęcie jako data: URI (tylko ten sam origin / CORS); błąd → null (użyjemy ikony)
  try {
    const r = await fetch(u, {credentials: 'same-origin'}); if (!r.ok) return null;
    const b = await r.blob();
    return await new Promise(ok => { const f = new FileReader(); f.onload = () => ok(f.result); f.onerror = () => ok(null); f.readAsDataURL(b); });
  } catch (e) { return null; }
}

/* Kolory dla motywu jasnego: ciemniejsze odcienie (jasne kolory magistral są nieczytelne na białym tle). */
function shadeForLight(c) {
  c = String(c).trim();
  let m = c.match(/^#([0-9a-f]{6})$/i), v = null;
  if (m) v = [0, 2, 4].map(i => parseInt(m[1].substr(i, 2), 16));
  else { m = c.match(/rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/i); if (m) v = [+m[1], +m[2], +m[3]]; }
  return v ? '#' + v.map(x => Math.round(x * 0.72).toString(16).padStart(2, '0')).join('') : c;
}

/* opts: theme ('dark' | 'light'; domyślnie z ustawienia „Motyw eksportu”), title (czy dorysować tytuł projektu; false dla PDF,
   który ma własny nagłówek). Zwraca {w, h, vb, inner, svg}: inner = zawartość bez znacznika <svg>. */
async function buildSVG(opts = {}) {
  const light = (opts.theme || SET.exportTheme) === 'light', withTitle = opts.title !== false;
  const P = light ? {BG: '#ffffff', CARD: '#f8fafc', BORDER: '#cbd2dc', SEP: '#e4e7ec', TEXT: '#1f2937', MUTED: '#667085', ACCENT: '#0b7a99'}
                  : {BG: '#0a0c10', CARD: '#141920', BORDER: '#1e2a3a', SEP: '#1e2a3a', TEXT: '#e0eaf5', MUTED: '#8a9ab5', ACCENT: '#56e1fd'};
  const col = c => light ? shadeForLight(c) : c;
  const nodes = nodeEls(); if (!nodes.length) return null;
  const photos = {};
  await Promise.all([...new Set(nodes.map(ne => ne.querySelector('.pico')?.dataset.img).filter(Boolean))].map(async u => { photos[u] = await toDataUrl(u); }));
  const wr = $('#world').getBoundingClientRect(), k = S.view.k;
  const R = e => { const r = e.getBoundingClientRect(); return {x: (r.left - wr.left) / k, y: (r.top - wr.top) / k, w: r.width / k, h: r.height / k}; };
  const cs = e => getComputedStyle(e);
  const FONT = {mono: "'JetBrains Mono',Consolas,monospace", sans: "'DM Sans','Segoe UI',sans-serif", display: "'Syne','DM Sans',sans-serif"};
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  const grow = r => { x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y); x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.h); };
  const num = v => Math.round(v * 10) / 10;
  const mctx = document.createElement('canvas').getContext('2d');
  const wrapText = (str, font, maxW) => {
    mctx.font = font; const lines = []; let cur = '';
    for (const w of str.split(/\s+/)) { const nx = cur ? cur + ' ' + w : w; if (cur && mctx.measureText(nx).width > maxW) { lines.push(cur); cur = w; } else cur = nx; }
    if (cur) lines.push(cur); return lines;
  };
  // kolor tekstu: w motywie ciemnym z DOM, w jasnym – wg roli elementu (kolory z DOM są dobrane pod ciemne tło)
  const tcol = e => {
    if (!light) return cs(e).color;
    if (e.matches('.nh b, .role b')) return P.TEXT;
    if (e.matches('.nval')) return P.ACCENT;
    if (e.matches('.pn')) return e.closest('.pin')?.classList.contains('used') ? P.TEXT : P.MUTED;
    if (e.matches('.role-h')) return col(cs(e).color);
    return P.MUTED;
  };
  const txt = e => {
    let s = e.textContent.trim(); if (!s) return '';
    const r = R(e), c = cs(e), fill = tcol(e);
    const lh = parseFloat(c.lineHeight) || parseFloat(c.fontSize) * 1.4;
    const f = c.fontFamily.includes('Syne') ? FONT.display : c.fontFamily.includes('Mono') ? FONT.mono : FONT.sans;
    if (r.h > lh * 1.5) {                                              // tekst zawinięty w kilku liniach
      return wrapText(s, `${c.fontWeight} ${c.fontSize} ${c.fontFamily}`, r.w).map((ln, i) =>
        `<text x="${num(r.x)}" y="${num(r.y + lh * (i + 0.5))}" dominant-baseline="central" font-family="${f}" font-size="${parseFloat(c.fontSize)}" font-weight="${c.fontWeight}" fill="${fill}">${esc(ln)}</text>`).join('');
    }
    if (e.scrollWidth > e.clientWidth + 1) s = s.slice(0, Math.max(1, Math.floor(s.length * e.clientWidth / e.scrollWidth) - 1)) + '…';
    if (c.textTransform === 'uppercase') s = s.toUpperCase();
    const ls = c.letterSpacing !== 'normal' ? ` letter-spacing="${parseFloat(c.letterSpacing)}"` : '';
    return `<text x="${num(r.x)}" y="${num(r.y + r.h / 2)}" dominant-baseline="central" font-family="${f}" font-size="${parseFloat(c.fontSize)}" font-weight="${c.fontWeight}"${ls} fill="${fill}">${esc(s)}</text>`;
  };

  let wires = '', nodesSvg = '', labels = '';
  $('#wires').querySelectorAll('g[data-e]').forEach(g => {
    const p = g.querySelector('.w'); if (!p) return;
    const bb = p.getBBox(); grow({x: bb.x, y: bb.y, w: bb.width, h: bb.height});
    wires += `<path d="${p.getAttribute('d')}" fill="none" stroke="${col(g.style.getPropertyValue('--c'))}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${p.classList.contains('pw') ? ' stroke-dasharray="6 5"' : ''}/>`;
  });
  nodes.forEach(ne => {
    const r = R(ne); grow(r);
    nodesSvg += `<rect x="${num(r.x)}" y="${num(r.y)}" width="${num(r.w)}" height="${num(r.h)}" rx="8" fill="${P.CARD}" stroke="${P.BORDER}"/>`;
    const h = ne.querySelector('.nh');
    if (h) {
      const hr = R(h);
      nodesSvg += `<rect x="${num(hr.x + 1)}" y="${num(hr.y)}" width="${num(hr.w - 2)}" height="3" rx="1.5" fill="${col(cs(h).borderTopColor)}"/>` +
                  `<line x1="${num(hr.x)}" x2="${num(hr.x + hr.w)}" y1="${num(hr.y + hr.h)}" y2="${num(hr.y + hr.h)}" stroke="${P.SEP}"/>`;
    }
    const pico = ne.querySelector('.pico');
    if (pico) {
      const pr = R(pico), pc = col(cs(pico).color), ph = pico.dataset.img && photos[pico.dataset.img];
      nodesSvg += `<rect x="${num(pr.x)}" y="${num(pr.y)}" width="${num(pr.w)}" height="${num(pr.h)}" rx="7" fill="${pc}" fill-opacity="0.14"/>`;
      nodesSvg += ph ? `<image href="${ph}" x="${num(pr.x)}" y="${num(pr.y)}" width="${num(pr.w)}" height="${num(pr.h)}" preserveAspectRatio="xMidYMid meet"/>`
        : `<g transform="translate(${num(pr.x + (pr.w - 18) / 2)},${num(pr.y + (pr.h - 18) / 2)}) scale(${18 / 24})" fill="none" stroke="${pc}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[pico.dataset.icon] || ICONS.box}</g>`;
    }
    ne.querySelectorAll('.pin .dot').forEach(d => {
      const dr = R(d); nodesSvg += `<circle cx="${num(dr.x + dr.w / 2)}" cy="${num(dr.y + dr.h / 2)}" r="5" fill="${col(cs(d).backgroundColor)}" stroke="${P.CARD}" stroke-width="2"/>`;
    });
    ne.querySelectorAll('.nh b, .nval, .nh small, .pnum, .pn, .pin em, .role-h, .role b, .role span, .muted').forEach(e => { nodesSvg += txt(e); });
  });
  $$('#nodes .tnote').forEach(ne => {               // notatki: tło, pasek koloru, tekst z zachowaniem nowych linii
    const r = R(ne), cc = col(ne.style.getPropertyValue('--c').trim()), te = ne.querySelector('.tn-text'); grow(r);
    nodesSvg += `<rect x="${num(r.x)}" y="${num(r.y)}" width="${num(r.w)}" height="${num(r.h)}" rx="8" fill="${P.CARD}" stroke="${cc}" stroke-opacity="0.45"/>` +
                `<rect x="${num(r.x)}" y="${num(r.y)}" width="${num(r.w)}" height="${num(r.h)}" rx="8" fill="${cc}" fill-opacity="0.10"/>` +
                `<rect x="${num(r.x)}" y="${num(r.y + 4)}" width="3" height="${num(r.h - 8)}" rx="1.5" fill="${cc}"/>`;
    if (!te || te.classList.contains('empty')) return;
    const tr = R(te), c = cs(te), lh = parseFloat(c.lineHeight) || parseFloat(c.fontSize) * 1.45, font = `${c.fontWeight} ${c.fontSize} ${c.fontFamily}`;
    te.textContent.split('\n').flatMap(par => par.trim() ? wrapText(par, font, tr.w) : ['']).forEach((ln, i) => {
      if (ln) nodesSvg += `<text x="${num(tr.x)}" y="${num(tr.y + lh * (i + 0.5))}" dominant-baseline="central" font-family="${FONT.sans}" font-size="${parseFloat(c.fontSize)}" fill="${light ? P.TEXT : cs(te).color}">${esc(ln)}</text>`;
    });
  });
  $('#labels').querySelectorAll('.elabel').forEach(l => {
    const r = R(l), warn = l.classList.contains('warn'), cc = col(warn ? '#ff4466' : l.style.getPropertyValue('--c').trim());
    const fillTxt = SET.labelFill ? (light || warn ? '#ffffff' : '#04161a') : cc;
    labels += `<rect x="${num(r.x)}" y="${num(r.y)}" width="${num(r.w)}" height="${num(r.h)}" rx="${num(r.h / 2)}" fill="${SET.labelFill ? cc : P.BG}" stroke="${cc}"/>` +
              `<text x="${num(r.x + r.w / 2)}" y="${num(r.y + r.h / 2)}" text-anchor="middle" dominant-baseline="central" font-family="${FONT.mono}" font-size="10" fill="${fillTxt}">${esc(l.textContent.trim())}</text>`;
  });

  // legenda użytych magistral i (opcjonalnie) tytuł projektu
  const pad = withTitle ? 40 : 18, padT = withTitle ? 66 : 18, foot = 44;
  const buses = [...new Set(S.p.links.map(l => info(l).bus))];
  let lx = x0, legend = '';
  buses.forEach(b => {
    const w = busName(b).length * 7 + 44;
    legend += `<line x1="${lx}" x2="${lx + 20}" y1="${y1 + 30}" y2="${y1 + 30}" stroke="${col(BUSC[b])}" stroke-width="3" stroke-linecap="round"${b === 'power' ? ' stroke-dasharray="5 4"' : ''}/>` +
              `<text x="${lx + 26}" y="${y1 + 30}" dominant-baseline="central" font-family="${FONT.mono}" font-size="11" fill="${P.MUTED}">${esc(busName(b))}</text>`;
    lx += w;
  });
  const title = withTitle ? `<text x="${x0}" y="${y0 - 22}" font-family="${FONT.display}" font-size="20" font-weight="800" fill="${P.TEXT}">${esc(titleOf(S.p))}</text>` +
                `<text x="${x0}" y="${y0 - 6}" font-family="${FONT.mono}" font-size="11" fill="${P.ACCENT}">${esc(t(S.mode === 'detail' ? 'modeDetail' : 'modeSimple'))}</text>` : '';
  const vx = x0 - pad, vy = y0 - padT, w = Math.ceil(Math.max(x1 - x0, lx - x0) + 2 * pad), h = Math.ceil((y1 - y0) + padT + pad + foot);
  const vb = `${num(vx)} ${num(vy)} ${w} ${h}`;
  const inner = `<rect x="${num(vx)}" y="${num(vy)}" width="${w}" height="${h}" fill="${P.BG}"/>${wires}${nodesSvg}${labels}${title}${legend}`;
  return {w, h, vb, inner, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${vb}">${inner}</svg>`};
}

async function exportImage(kind) {
  const o = await buildSVG(); if (!o) return;
  if (kind === 'svg') { download(new Blob([o.svg], {type: 'image/svg+xml'}), fname('svg')); return; }
  const url = URL.createObjectURL(new Blob([o.svg], {type: 'image/svg+xml;charset=utf-8'}));
  try {
    const img = new Image();
    await new Promise((ok, err) => { img.onload = ok; img.onerror = err; img.src = url; });
    const sc = Math.min(2, 8000 / Math.max(o.w, o.h)), cv = document.createElement('canvas');
    cv.width = Math.round(o.w * sc); cv.height = Math.round(o.h * sc);
    const cx = cv.getContext('2d'); cx.scale(sc, sc); cx.drawImage(img, 0, 0, o.w, o.h);
    const blob = await new Promise(ok => cv.toBlob(ok, 'image/png'));
    download(blob, fname('png'));
  } catch (err) { alert(t('exportErr')); }
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------------ eksport CSV (lista części, lista połączeń) */
/* Separator: ';' dla PL (Excel w polskiej wersji), ',' dla EN. Znacznik BOM, żeby Excel poprawnie czytał polskie znaki.
   Komórki zaczynające się od = + - @ (formuły w arkuszu) dostają apostrof na początku – ochrona przed wstrzyknięciem formuły. */
function csvCell(v, d) {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return (s.includes(d) || /["\n\r]/.test(s)) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function downloadCsv(rows, kind) {
  const d = LANG === 'pl' ? ';' : ',';
  const text = '\uFEFF' + rows.map(r => r.map(c => csvCell(c, d)).join(d)).join('\r\n') + '\r\n';
  download(new Blob([text], {type: 'text/csv;charset=utf-8'}), ((titleOf(S.p) || 'schemat').replace(/[^\w-]+/g, '_')) + '_' + kind + '.csv');
}

function bomRows() {
  const g = new Map();                                                     // grupa = ta sama część i ta sama wartość
  S.p.nodes.forEach(n => { const k = n.part + '\u0000' + nodeValue(n); if (!g.has(k)) g.set(k, {id: n.part, value: nodeValue(n), refs: []}); g.get(k).refs.push(nodeLabel(n)); });
  const rows = [['csv.no', 'csv.part', 'csv.value', 'csv.category', 'csv.qty', 'csv.refs', 'csv.package', 'csv.source', 'csv.partId', 'csv.datasheet'].map(k => t(k))];
  let i = 1;
  for (const {id, value, refs} of g.values()) {
    const pt = S.parts[id];
    rows.push([i++, pt ? loc(pt, 'name') : id, value, pt ? catName(pt.category) : '', refs.length, refs.join(', '), pt?.package || '',
               pt ? t(pt.source === 'catalog' ? 'src.catalog' : 'src.own') : '', id, pt?.datasheet || '']);
  }
  return rows;
}

function connRows() {
  const par = new Map();                                                   // sieci (nets): pin połączony z pinem = ta sama sieć
  const find = x => { if (!par.has(x)) par.set(x, x); let r = x; while (par.get(r) !== r) r = par.get(r); par.set(x, r); return r; };
  const key = r => r.n + '|' + r.p;
  S.p.links.forEach(l => par.set(find(key(l.a)), find(key(l.b))));
  const netNo = new Map();
  const net = r => { const root = find(key(r)); if (!netNo.has(root)) netNo.set(root, 'N' + (netNo.size + 1)); return netNo.get(root); };
  const rows = [['csv.no', 'csv.net', 'csv.fromPart', 'csv.fromPin', 'csv.fromNum', 'csv.fromFn', 'csv.toPart', 'csv.toPin', 'csv.toNum', 'csv.toFn',
                 'csv.signal', 'csv.note', 'csv.warn'].map(k => t(k))];
  S.p.links.forEach((l, i) => {
    const a = pinOf(l.a), b = pinOf(l.b), na = nodeById(l.a.n), nb = nodeById(l.b.n), inf = info(l);
    rows.push([i + 1, net(l.a), na ? nodeLabel(na) : '?', a ? a.name : l.a.p, a?.num || '', a ? loc(a, 'desc') || '' : '',
               nb ? nodeLabel(nb) : '?', b ? b.name : l.b.p, b?.num || '', b ? loc(b, 'desc') || '' : '',
               busName(inf.bus), noteOf(l), inf.warn.join(' | ')]);
  });
  return rows;
}

/* ------------------------------------------------------------------ eksport PDF (druk z przeglądarki) */
/* Budujemy samodzielny dokument HTML (nagłówek, schemat jako wektorowe SVG, tabele) z własnym CSS do druku. Otwieramy go w nowej
   karcie z podglądem i wywołujemy okno druku – użytkownik wybiera „Zapisz jako PDF”. Ten sam dokument da się później
   renderować po stronie serwera (WeasyPrint / Chromium), bo nie zależy od skryptów ani od stylów edytora. */
function printSections(o) {
  const out = [];
  const table = (head, rows) => `<table><thead><tr>${head.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>` +
    rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('') + '</tbody></table>';
  if (o.parts) {
    const rows = bomRows();
    out.push(`<section class="sec"><h2>${esc(t('pdf.parts'))}</h2>${table(rows[0].slice(0, 8), rows.slice(1).map(r => r.slice(0, 8)))}</section>`);
  }
  if (o.conns) {
    const rows = connRows(), pin = (part, name, num) => `${part} · ${num ? num + ' ' : ''}${name}`;
    const head = [t('csv.no'), t('csv.net'), t('pdf.from'), t('pdf.to'), t('csv.signal'), t('csv.note'), t('csv.warn')];
    out.push(`<section class="sec"><h2>${esc(t('pdf.conns'))}</h2>${table(head, rows.slice(1).map(r => [r[0], r[1], pin(r[2], r[3], r[4]), pin(r[6], r[7], r[8]), r[10], r[11], r[12]]))}</section>`);
  }
  if (o.check) {
    const V = validate();
    out.push(`<section class="sec"><h2>${esc(t('checkH'))}</h2>` +
      (V.warns.length ? `<ul class="warns">${V.warns.map(x => `<li>⚠ ${esc(x.text)}</li>`).join('')}</ul>` : '') +
      (V.hints.length ? `<h3>${esc(t('checkHints'))}</h3><ul class="hints">${V.hints.map(x => `<li>${esc(x.text)}</li>`).join('')}</ul>` : '') +
      (!V.warns.length && !V.hints.length ? `<p class="ok">${esc(t('noIssues'))}</p>` : '') + '</section>');
  }
  return out;
}

function buildPrintHTML(o, svgObj) {
  const light = o.theme === 'light';
  const land = o.orient === 'land' || (o.orient === 'auto' && !!svgObj && svgObj.w >= svgObj.h);
  const base = o.size === 'A3' ? [297, 420] : [210, 297], mg = 12;
  const ph = land ? base[0] : base[1];
  const diagMax = Math.max(60, ph - 2 * mg - 30);                         // mm: wysokość strony bez marginesów i nagłówka
  const date = new Date().toLocaleDateString(LANG === 'pl' ? 'pl-PL' : 'en-GB');
  const fonts = [...new Set([...document.querySelectorAll('link[rel~="stylesheet"]')].map(l => l.href).filter(h => /fonts\.googleapis|font/i.test(h)).concat(opts.printCss || window.SCH_PRINT_CSS || []))];
  const secs = printSections(o);
  const diagram = svgObj ? `<section class="diagram${secs.length ? ' brk' : ''}"><svg xmlns="http://www.w3.org/2000/svg" viewBox="${svgObj.vb}" style="max-height:${diagMax}mm">${svgObj.inner}</svg></section>` : '';
  return `<!doctype html><html lang="${LANG}"><head><meta charset="utf-8"><title>${esc(titleOf(S.p))}</title>
${fonts.map(h => `<link rel="stylesheet" href="${esc(h)}">`).join('\n')}
<style>
@page{size:${o.size} ${land ? 'landscape' : 'portrait'};margin:${mg}mm}
@page{@bottom-right{content:counter(page) " / " counter(pages);font:10px sans-serif;color:#667085}}
:root{--bg:${light ? '#ffffff' : '#0a0c10'};--fg:${light ? '#1f2937' : '#e0eaf5'};--mut:${light ? '#667085' : '#8a9ab5'};--line:${light ? '#e4e7ec' : '#1e2a3a'};--head:${light ? '#eef1f5' : '#141920'};--acc:${light ? '#0b7a99' : '#56e1fd'};--ok:${light ? '#2f6f4a' : '#00ff88'};--bad:${light ? '#b42318' : '#ff9bb0'}}
*{box-sizing:border-box}
html,body{margin:0;background:var(--bg);color:var(--fg);-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font:11px/1.45 'DM Sans','Segoe UI',system-ui,sans-serif;padding:16px;max-width:1200px;margin:0 auto}
.toolbar{display:flex;gap:12px;align-items:center;margin-bottom:14px;padding:10px 12px;border:1px solid var(--line);border-radius:8px;font-size:12px;color:var(--mut)}
.toolbar button{font:inherit;padding:6px 12px;border-radius:6px;border:1px solid var(--acc);background:var(--acc);color:#fff;cursor:pointer;font-weight:600}
header.doc{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:1px solid var(--line);padding-bottom:6px;margin-bottom:10px}
h1{margin:0;font:800 18px 'Syne','DM Sans',system-ui,sans-serif}
.sub{color:var(--mut);font:11px 'JetBrains Mono',Consolas,monospace}
.brand{color:var(--acc);font:700 11px 'JetBrains Mono',Consolas,monospace;text-transform:uppercase;letter-spacing:.08em}
.diagram svg{display:block;width:100%;height:auto;margin:0 auto}
.brk{break-after:page}
.sec{margin:0 0 14px}
h2{font:700 13px 'Syne','DM Sans',system-ui,sans-serif;margin:0 0 6px}
table{border-collapse:collapse;width:100%;font-size:10px}
th,td{border-bottom:1px solid var(--line);padding:3px 6px;text-align:left;vertical-align:top}
th{background:var(--head);color:var(--mut);font-weight:600}
thead{display:table-header-group}
tr{break-inside:avoid}
.warns{margin:0;padding-left:16px;color:var(--bad)}
.ok{margin:0;color:var(--ok)}
h3{font:600 11px 'DM Sans',system-ui,sans-serif;margin:8px 0 3px;color:var(--mut)}
.hints{margin:0;padding-left:16px;color:var(--mut)}
@media print{.toolbar{display:none}body{padding:0;max-width:none}}
</style></head><body>
<div class="toolbar"><button id="pbtn">${esc(t('pdf.printBtn'))}</button><span>${esc(t('pdf.hint'))}</span></div>
<header class="doc"><div><h1>${esc(titleOf(S.p))}</h1><div class="sub">${esc(t(S.mode === 'detail' ? 'modeDetail' : 'modeSimple'))} · ${esc(date)}</div></div><div class="brand">${esc(t('brand'))}</div></header>
${diagram}${secs.join('')}
</body></html>`;
}

async function printPdf(o, w) {
  try {
    const svgObj = o.diagram ? await buildSVG({theme: o.theme, title: false}) : null;
    w.document.open(); w.document.write(buildPrintHTML(o, svgObj)); w.document.close();
    const btn = w.document.getElementById('pbtn'); if (btn) btn.onclick = () => w.print();
    const ready = w.document.fonts && w.document.fonts.ready ? w.document.fonts.ready : Promise.resolve();
    ready.then(() => setTimeout(() => { try { w.focus(); w.print(); } catch (e) { /* druk z przycisku w podglądzie */ } }, 400));
  } catch (err) { try { w.close(); } catch (e) { /* ignoruj */ } alert(t('exportErr')); }
}

function openPdfDialog() {
  const o = SET.pdf;
  $('#pdfDiagram').checked = !!o.diagram; $('#pdfParts').checked = !!o.parts; $('#pdfConns').checked = !!o.conns; $('#pdfCheck').checked = !!o.check;
  $('#pdfSize').value = o.size; $('#pdfOrient').value = o.orient; $('#pdfTheme').value = o.theme;
  $('#pdfDlg').showModal();
}
$('#pdfCancel').onclick = () => $('#pdfDlg').close();
$('#pdfGo').onclick = () => {
  const o = {diagram: $('#pdfDiagram').checked, parts: $('#pdfParts').checked, conns: $('#pdfConns').checked, check: $('#pdfCheck').checked,
             size: $('#pdfSize').value === 'A3' ? 'A3' : 'A4', orient: ['land', 'port'].includes($('#pdfOrient').value) ? $('#pdfOrient').value : 'auto',
             theme: $('#pdfTheme').value === 'dark' ? 'dark' : 'light'};
  if (!o.diagram && !o.parts && !o.conns && !o.check) { alert(t('pdf.noContent')); return; }
  SET.pdf = o; saveSettings(); $('#pdfDlg').close();
  const w = window.open('', '_blank');                         // okno otwieramy od razu (gest użytkownika), treść dopiero po zbudowaniu
  if (!w) { alert(t('pdf.popup')); return; }
  printPdf(o, w);
};

/* Wąski edytor: pasek przewija się w bok (overflow), więc menu otwieramy z pozycją „fixed” liczoną od przycisku – inaczej zostałoby ucięte. */
function placeMenu(menu, btn) {
  if (!root.classList.contains('narrow') || menu.hidden) { menu.style.left = menu.style.top = menu.style.right = ''; return; }
  const r = btn.getBoundingClientRect(), w = Math.min(300, window.innerWidth - 16);
  Object.assign(menu.style, {top: Math.round(r.bottom + 4) + 'px', left: Math.round(Math.max(8, Math.min(r.left, window.innerWidth - w - 8))) + 'px', right: 'auto'});
}
$('#btnExport').onclick = e => { e.stopPropagation(); $('#viewMenu').hidden = true; $('#expMenu').hidden = !$('#expMenu').hidden; placeMenu($('#expMenu'), e.currentTarget); };
$('#btnView').onclick = e => { e.stopPropagation(); $('#expMenu').hidden = true; $('#viewMenu').hidden = !$('#viewMenu').hidden; placeMenu($('#viewMenu'), e.currentTarget); };
$('#top').addEventListener('scroll', () => { $('#expMenu').hidden = true; $('#viewMenu').hidden = true; });
$('#viewMenu').onchange = e => {
  if (e.target.id === 'setExportTheme') { SET.exportTheme = e.target.value === 'light' ? 'light' : 'dark'; saveSettings(); return; }
  if (e.target.id === 'setDensity') { if (S.p && S.edit) { if (e.target.value === 'compact') S.p.density = 'compact'; else delete S.p.density; mark(); renderCanvas(); } return; }
  if (e.target.id === 'setOrient') { if (S.p && S.edit) { S.p.orient = e.target.value; mark(); renderCanvas(); } return; }
  SET.hints = $('#setHints').checked; SET.icons = $('#setIcons').checked; SET.photos = $('#setPhotos').checked; SET.labelFill = $('#setFill').checked;
  try { localStorage.setItem('sch.set', JSON.stringify(SET)); } catch (e) { /* tryb prywatny */ }
  applySettings(); render();
};
$('#expMenu').onclick = e => {
  const b = e.target.closest('button'); if (!b || !S.p) return;
  $('#expMenu').hidden = true;
  const x = b.dataset.x;
  if (x === 'json') exportJson();
  else if (x === 'bom') downloadCsv(bomRows(), 'bom');
  else if (x === 'conn') downloadCsv(connRows(), 'connections');
  else if (x === 'pdf') openPdfDialog();
  else exportImage(x);
};
on(document, 'click', e => { if (!root.contains(e.target) || !e.target.closest('.menuwrap')) { $('#expMenu').hidden = true; $('#viewMenu').hidden = true; } });

/* ------------------------------------------------------------------ chowanie paneli bocznych */
function restorePanels() {
  const narrow = root.clientWidth > 0 && root.clientWidth < NARROW_PX;   // telefon / wąska karta: same płótno, panele pod ◧ / ◨
  ['lib', 'insp'].forEach(k => root.classList.toggle(k + '-off', (k === 'lib' && opts.readOnly) || narrow || localStorage.getItem('sch.' + k + 'Off') === '1'));   // ESN: podgląd bez biblioteki części
}
function togglePanel(k) {
  const off = root.classList.toggle(k + '-off');
  localStorage.setItem('sch.' + k + 'Off', off ? '1' : '0');
}
$('#togLib').onclick = () => togglePanel('lib');
$('#togInsp').onclick = () => togglePanel('insp');

$('#btnImport').onclick = () => $('#fileIn').click();
$('#fileIn').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    for (const p of Object.values(d.parts || {})) { if (String(p.id).startsWith('cat-')) continue; await api('PUT', '/parts/' + encodeURIComponent(p.id), p); S.parts[p.id] = p; }
    const p = await api('POST', '/projects', {...d.project, id: undefined});
    S.dirty = false; await loadProjects(p.id); loadLib(true);
  } catch (err) { alert(t('badFile', err.message)); }
  e.target.value = '';
};

on(window, 'beforeunload', e => { if (S.dirty) { e.preventDefault(); e.returnValue = ''; } });

/* ------------------------------------------------------------------ start instancji */
$('#editChk').checked = S.edit;
if (opts.readOnly) $('#editChk').closest('label').hidden = true;     // osadzenie tylko do odczytu: bez przełącznika edycji
if (opts.single) ['#projSel', '#btnNew'].forEach(s => { const el = $(s); if (el) el.hidden = true; });   // ESN: bez listy i tworzenia schematów
if (opts.hideLang) $('#langSel').hidden = true;
/* ESN: motyw (etap 11) – opts.theme: 'light' | 'dark' | 'auto' (wg atrybutu data-theme strony; zmiana na żywo przez zdarzenie esn-theme) */
const isLight = () => opts.theme === 'light' || (opts.theme === 'auto' && document.documentElement.getAttribute('data-theme') === 'light');
const applyTheme = () => root.classList.toggle('light', isLight());
applyTheme();
if (opts.theme === 'auto') on(document, 'esn-theme', applyTheme);
if (opts.readOnly) ['#btnSave', '#btnLayout', '#btnNote', '#btnImport', '#btnNew', '#togLib'].forEach(s => { const el = $(s); if (el) el.hidden = true; });   // ESN: podgląd bez akcji zapisu
if (opts.readOnly) $('#projTitle').disabled = true;                         // ESN: język ustawia platforma (opts.lang)
on(root, 'pointerdown', () => { ACTIVE = inst; }, true);
on(root, 'focusin', () => { ACTIVE = inst; });
/* Klasa „narrow” wg szerokości samego edytora (nie okna) – działa też w wąskiej karcie po osadzeniu. */
const NARROW_PX = 760, setNarrow = () => root.classList.toggle('narrow', root.clientWidth > 0 && root.clientWidth < NARROW_PX);
setNarrow();
if (window.ResizeObserver) { const ro = new ResizeObserver(setNarrow); ro.observe(root); subs.push([{removeEventListener: () => ro.disconnect()}, '', null]); }
const ready = (async () => {
  applyStatic(); applySettings(); restorePanels(); loadLib(true);
  $('#nodes').addEventListener('error', e => {                   // zdjęcie się nie wczytało → zostaje ikona
    if (e.target.tagName === 'IMG' && e.target.closest('.pico')) { e.target.closest('.pico').classList.remove('photo'); e.target.remove(); }
  }, true);
  await loadProjects(opts.project);
})();

inst = {
  root, ready,
  open: id => openProject(id),
  save: () => saveProject(),
  setLang,
  setEdit: on_ => { S.edit = !!on_; $('#editChk').checked = S.edit; render(); },
  get project() { return S.p; },
  get dirty() { return S.dirty; },
  destroy() {
    offAll(); clearTimeout(H.timer); clearTimeout(libTimer);
    if (ACTIVE === inst) ACTIVE = null;
    root.innerHTML = ''; root.classList.remove('sch', 'ro', 'fill-labels', 'lib-off', 'insp-off'); delete root.__sch;
  },
};
if (window.SCH_DEBUG) {                         // testy: wnętrze instancji (pierwsza instancja trafia też na window)
  inst.__dbg = {S, H, SET, $, $$, select, selFromIds, selIds, selectAll, openProject, loadProjects, render, renderCanvas, renderInsp,
    drawWires, fit, validate, info, nodeById, noteById, itemEl, itemById, histReset, ensureParts, addNode, addNote, addLink, copySel,
    pasteClip, dragStart, dragApply, moveSel, alignSel, buildSVG, bomRows, connRows, parseValue, valueStr, fmtValue, splitValue, api,
    openPdfDialog, openPart, normalizeProject, groupKey, saveProject, delSel, undo, redo, mark, commit, cardUrl, nodeValue, autoLayout,
    printSections, buildPrintHTML, setLang, loadLib, applyStatic, applyView, vpPoint, PT};
  if (!window.__schDbg) { window.__schDbg = true; Object.assign(window, inst.__dbg); }
}
if (!ACTIVE) ACTIVE = inst;
root.__sch = inst;
return inst;
}

window.SchematEditor = {mount, version: '9a'};
/* Zgodność wsteczna: strona z <div id="sch"> uruchamia edytor sama (wyłączenie: window.SCH_AUTOMOUNT = false). */
function auto() { const el = document.getElementById('sch'); if (el && !el.__sch && window.SCH_AUTOMOUNT !== false) mount(el, window.SCH_OPTIONS || {}); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto); else auto();
})();
