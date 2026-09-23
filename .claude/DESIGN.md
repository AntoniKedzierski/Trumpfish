# Zasady UI w Trumpfish

Obowiązują przy **każdej** zmianie widocznej dla użytkownika, w każdej sesji. Czytaj je **zanim** napiszesz styl albo
komponent, i **sprawdź je drugi raz po skończeniu pracy** (rozdział 11).

## 1. Spójność jest wymogiem, nie życzeniem

Zanim napiszesz nową regułę CSS albo komponent, sprawdź, czy ta rzecz już gdzieś jest — najpierw w `src/ui`. Jeśli jest
— użyj jej; gdy trzeba ją uogólnić, uogólnij **tę jedną**, zamiast pisać drugą. Dwie kopie tego samego paska, panelu czy
kafelka **zawsze** się rozjeżdżają.

Ta sama rzecz ma się w całej aplikacji tak samo **nazywać**, tak samo **wyglądać** i tak samo **zachowywać**.

**Czego użyjesz drugi raz, to jest kontrolka.** Nie drugie `<div>` z tymi samymi klasami.

## 2. Przyciski: trzy rozmiary, dwa style

| rozmiar | wysokość | czcionka | gdzie |
|---|---|---|---|
| `large` | 40 px | `--text-base` 14 px | nagłówek aplikacji **i szuflada** — jedno i to samo, bez wyjątków |
| normalny (domyślny) | 34 px | `--text-sm` 13 px | paski narzędzi, strony, karty |
| `small` | 30 px | `--text-xs` 12 px | **wszystko wewnątrz popupów i okien**, wiersze paginacji |

Styl: **standard** (ciemna płytka) albo **accented** (`variant="primary"`). `danger` to nie trzeci styl, tylko czerwony
hover rzeczy nieodwracalnej — i nigdy nie łączy się z `primary`.

- Przycisk pisze się jako `<Button>` z `src/ui`. Surowe `<button>` jest dopuszczalne tylko dla rysowanych kontrolek
  bez etykiety słownej (komórka bidding boxa, macierz figur, wybór wtrącenia, numer strony).
- **Wszystkie przyciski w jednym równoległym układzie mają ten sam rozmiar i tę samą czcionkę.**
- **Maksymalnie jeden `primary` na widok**; okno modalne i popup liczą się jako osobny widok.
- Nigdy nie rozciągaj przycisków na całą szerokość.
- Dotyczy **każdej klikalnej rzeczy z tekstem, która wywołuje akcję**: przycisków, list wyboru, wyzwalaczy popupów,
  pozycji menu, chipów w rodzaju "Analizuj".

## 3. Ikonki

- **Każdy przycisk z tekstem ma ikonkę SVG** — także w oknach, formularzach i na kartach. Ikonki są w
  `components/icons.tsx` (24 px box, `currentColor`, stroke 2.2). **Żadnych emoji.**
- **Każda pozycja menu komend ma ikonkę i jest wyrównana do lewej** (`MenuRow`, `NavRow`). Nie dotyczy list wartości.
- **Kontrolka, która zawiera ikonkę, wyrównuje treść przez `align-items: center`.** `align-items: baseline` jest
  zarezerwowane dla wierszy z tekstem i znakiem koloru i **nie wolno** dokładać do nich ikonki — ikonka nie ma linii
  pisma i zawiśnie pod tekstem (błąd chipa "Analizuj").
- **Nigdy nie łącz stałej wysokości z `align-items: baseline`** — pojedynczy element usiądzie na linii pisma wysokiego
  wiersza zamiast na jego środku (błąd chipa "Analiza").

## 4. Paski narzędzi

Jedna definicja: `components/ToolBar.tsx` + `styles/toolbar.css`. Żaden widok nie buduje paska sam.

- **Komendy od lewej**, **stan widoku (busy, błąd, licznik) do prawej**. Nigdy odwrotnie.
- Pasek przyklejony do góry przez ramkę: widok dopisuje selektor do `.app-shell:has(> …)` w `AppLayout.css`
  (`height: 100dvh; overflow: hidden`), zawartość przewija się pod nim.
- **Zawsze jedna linijka**, też na telefonie: `flex-wrap: nowrap`. Kiedy komendy przestają się mieścić, `ToolBar`
  **mierzy** je (`useFitsOnOneRow`) i dokłada `icons-only` — słowa znikają dopiero wtedy, nigdy z progu szerokości
  ekranu. Etykieta zostaje w drzewie dostępności.
- **Chowanie słów dotyczy wyłącznie własnego rzędu paska** — selektory przez dziecko bezpośrednie
  (`.toolbar > .toolbar-commands > …`). Panel popupu jest rysowany **wewnątrz** paska, więc reguła zapisana przez
  potomka gasi też etykiety w panelu i wartość w ComboBoksie.
- Filtry i ustawienia w popupach, nie jako pola na pasku. Najwyżej jeden `primary`.

## 5. Popupy, dropdowny, panele

- **Jeden komponent panelu dla wszystkich popupów:** `ui/Popup.tsx` (wyzwalacz + panel) i `ui/Panel.tsx` (sama
  powierzchnia). Konto, znajomi, wybór systemu, skróty, filtry, sortowanie, menu komend — wszystko przez to samo.
  Pliki feature'owe dokładają **treść**, nie styl panelu.
- **W popupie jest dokładnie jedna czcionka: `--text-xs` (12 px).** Etykiety, pozycje list, przyciski, komentarze,
  nagłówki sekcji — wszystko. Egzekwuje to `ui/panel.css` regułą na `.ui-panel *`; nie da się jej złamać z pliku widoku
  i to jest cel.
- **Wszystkie kontrolki w popupie są `small`** — także pola i listy wyboru, bo pole 34 px obok przycisku 30 px w jednym
  wierszu to dokładnie ta niespójność, o którą chodzi.
- **Wariant panelu zapisuje się przez `.ui-panel.nazwa`, nigdy samą `.nazwa`.** Wspólny arkusz panelu trafia do bundla
  po arkuszach feature.owych, więc reguła o jednej klasie przegrywa z nim kolejnością i wariant cicho przestaje
  działać — tak zniknęła szerokość panelu skrótów i panelu znajomych.
- **Margines panelu daje `.ui-panel-body` i nic w środku nie dokłada własnego wcięcia po bokach** — pola, przyciski i
  uwagi mają stać w jednej kolumnie lewych krawędzi.
- Pozycje list: do lewej, z ikonką (dla menu komend).
- Okno modalne: `ui/Dialog.tsx`, pytanie z dwiema odpowiedziami: `ui/Dialog.tsx → ConfirmDialog`.
- **Żadna warstwa otwierana przez kontrolkę nie ma prawa być przycięta przez kontener, w którym ta kontrolka stoi** —
  ani przez panel popupu, ani przez kartę, ani przez ramkę z własnym przewijaniem. Lista wartości `ComboBoksa` jest
  rysowana przez `createPortal` do `body` i pozycjonowana `fixed` z prostokąta pola (`ui/ComboBox.tsx`). Taka warstwa
  nosi `data-ui-overlay`, a każdy, kto nasłuchuje „kliknięcia obok", pyta o nią `isInsideOverlay` z `ui/overlay.ts` —
  inaczej popup zamyka się w chwili wyboru z listy, która w nim stoi. Rozmiar dziedziczony po kontenerze (`.ui-panel *`)
  już do niej nie dociera, więc jedzie z nią jako klasa (`.ui-combo-list.small`).
- **Żadna warstwa nie ma prawa wystawać poza to, co widać.** Panel opada spod wyzwalacza, a wyzwalacz bywa przy samej
  krawędzi — ostatnia komenda paska, kolumna podzielonego widoku, telefon — i wtedy połowa panelu jest poza ekranem.
  Warstwa jest **mierzona przy otwarciu i cofana** o tyle, ile wystaje: `horizontalNudge` z `ui/keepOnScreen.ts`,
  nałożone przez `translate` (`--panel-shift` w `ui/Panel.tsx`, `--bid-shift` w dymku odzywki). **Granicą nie jest samo
  okno**, tylko okno **i każda przewijana ramka nad warstwą** — w tej aplikacji każdy widok z paskiem narzędzi jest taką
  ramką, więc dymek mieszczący się w oknie bywa ucinany przez kolumnę, w której stoi. Kiedy warstwa się mieści,
  przesunięcie jest zerem i nie zmienia się nic.

## 6. Gdzie wolno ustawiać styl kontrolki

**Wysokość, padding, `font-size`, `gap` i `align-items` klikalnych elementów żyją wyłącznie w jednym pliku:**
`src/ui/controls.css`.

Pliki widoków i feature'ów mogą ustawiać **tylko** kolor, tło, obramowanie, promień i położenie. Jeśli naprawdę trzeba
zrobić wyjątek (rysowane kontrolki z rozdziału 2), napisz nad nim komentarz z powodem — inaczej za tydzień nikt nie
odróżni wyjątku od niedopatrzenia.

Sprawdzenie po zmianie:
`grep -rn "height:\|padding:\|font-size:\|align-items:" src --include=*.css | grep -v "src/ui/"` — to, co wyjdzie, ma
dotyczyć wyłącznie rzeczy nieklikalnych.

## 7. Formularze, pola i etykiety

- **Nie stawiaj etykiety obok kontrolki w jednej linii** — etykieta stoi **nad** kontrolką. Robi to `Field`.
- **Placeholder to przykład, nie instrukcja**: jedno słowo albo jedna wartość. Składnię wyjaśnia `HelpTip` przy etykiecie
  (`Field` przyjmuje go jako `hint`).
- Pola mają widoczną etykietę; sam placeholder nie jest etykietą.

## 8. Kolekcja kontrolek: `src/ui`

Nic z tego nie pisze się drugi raz. Import zawsze przez `@/ui`.

**Ogólne**

| kontrolka | co to jest |
|---|---|
| `Button` | przycisk: `size`, `variant`, `icon`, `iconOnly` |
| `TextBox` | pole tekstowe (`type` text/number/password/search, `onSubmit` = Enter) |
| `ComboBox` | lista wyboru (własna, bo natywnego `select` nie da się otematować) |
| `CheckBox` | pole wyboru z etykietą; celem jest cały wiersz |
| `Field` | etykieta nad kontrolką + `hint` + `note`; `ComboBoxField`, `TextBoxField` to gotowe pary |
| `Popup` | wyzwalacz + panel — **jedyny** sposób, w jaki coś się w tej aplikacji otwiera |
| `Panel`, `PanelSection`, `PanelSeparator`, `PanelNote` | powierzchnia popupu i jej części |
| `MenuPopup`, `MenuRow`, `NavRow` | lista komend i pojedynczy wiersz listy (komenda albo miejsce) |
| `Dialog`, `ConfirmDialog` | okno modalne i pytanie z dwiema odpowiedziami |

**Brydżowe** (`src/ui/bridge`)

| kontrolka | co to jest |
|---|---|
| `BidCard` | jedna odzywka: `1NT`, `1♠`, pas, kontra, rekontra — **jedyne** miejsce, gdzie odzywka jest rysowana |
| `Contract` | kontrakt, rysowany jak odzywka |
| `Hand` | jedna ręka: cztery kolory, punkty, rozkład |
| `Deal` | cztery ręce w układzie 2×2, na każdej szerokości |
| `Auction` | licytacja jako tabela czterech kolumn |
| `DealCard` | całe rozdanie: nagłówek, kontrakt, ręce, licytacja; komendy wchodzą przez `footnote` |

Poza tym: znaki kolorów rysuje wyłącznie `components/suits.tsx` (`SuitMark`, `DoubleMark`, `RedoubleMark`), nazwy i
ikonki narzędzi biorą się z `tools/toolsRegistry.ts`, a listy zapisanych rozdań składają się z części w
`features/savedDeals/DealPieces.tsx`.

## 9. Paginacja

Pasek pod listą: `‹` + numery (okno pięciu wokół bieżącej) + `›`, przyciski `small`, bieżąca strona przez
`aria-current` i tło akcentu (nie `primary` — to stan, nie komenda). Liczba na stronie i kolejność są w popupie
"Sortowanie".

## 10. Typografia, odstępy, kolory

- Rozmiary czcionek wyłącznie ze skali `--text-*`, odstępy ze skali `--space-*`.
- Nie zmieniaj czcionki, żeby coś się zmieściło — zmień układ.
- Znaki kolorów stoją na linii pisma; `SuitMark` nigdy bezpośrednio w kontenerze flex/grid. Pionowe wymiary znaku na
  pełne piksele (`--mark-box: 1em`).
- Cokolwiek leży w jednym wierszu, ma być idealnie wyrównane w pionie.

## 11. Jak sprawdzać (obowiązkowo po każdej zmianie UI)

Regresy wzięły się z trzech nawyków. Każdy ma tu swoje lekarstwo:

1. **Poprawiane było to, co na zrzucie, a nie cała klasa błędu.** Wyśrodkowany "Wyloguj" w szufladzie to ten sam błąd co
   wyśrodkowane pozycje menu, naprawiony wcześniej w innym pliku, i ten sam co wyśrodkowany wiersz walidacji.
   → Po każdej zmianie reguły **wyszukaj wszystkie miejsca, których dotyczy**: `grep -rn "align-items\|justify-content"`
   przy wyrównaniu, `grep -rn "font-size" --include=*.css` przy typografii, `grep -rn "<button" --include=*.tsx` przy
   przyciskach.
2. **Reguła w prozie, egzekwowanie w rozsypanych selektorach.** "Panel dziedziczy rozmiar po wyzwalaczu" działało dla
   `.menu-panel`, a `.friends-panel` i `.picker-list` nigdy o tym nie słyszały.
   → Reguła ma mieć **jedno miejsce w kodzie** (rozdziały 6 i 8). Jeśli nie da się jej tam zapisać, jest źle
   sformułowana.
3. **Liczby brane z ustaleń bez patrzenia na wynik.** 44 px / 16 px w nagłówku było zgodne z zapisem i wyglądało źle.
   → Po zmianie rozmiarów **powiedz użytkownikowi, co urosło lub zmalało**, i poproś o spojrzenie, zanim uznasz temat za
   zamknięty.

Lista kontrolna: rozmiary przycisków w każdym zmienionym układzie · ikonki · wyrównanie pozycji dropdownów · jeden akcent
na widok · pasek w jednej linijce · jedna czcionka w popupie · `tsc -b`, `eslint`, `vite build`.

Skill **`ui-ux-pro-max`** obowiązuje. Interfejs testuje użytkownik ręcznie — nie uruchamiaj przeglądarki.
