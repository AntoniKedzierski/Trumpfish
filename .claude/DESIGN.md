# Zasady UI w Trumpfish

Obowiązują przy **każdej** zmianie widocznej dla użytkownika, w każdej sesji. Czytaj je **zanim** napiszesz styl albo
komponent, i **sprawdź je drugi raz po skończeniu pracy** (rozdział 11).

> **Stan wdrożenia (2026-09-16):** rozdziały 2, 5 i 6 zostały poprawione po uwagach użytkownika i kod jeszcze im nie
> odpowiada — nagłówek i szuflada mają dziś 44 px / 16 px zamiast 40 px / 14 px, popupy mają po kilka rozmiarów czcionek,
> a panele nadal są osobnymi implementacjami. Do zrobienia po uzgodnieniu z użytkownikiem.

## 1. Spójność jest wymogiem, nie życzeniem

Zanim napiszesz nową regułę CSS albo komponent, sprawdź, czy ta rzecz już gdzieś jest. Jeśli jest — użyj tej samej
definicji; gdy trzeba ją uogólnić, przenieś ją do wspólnego pliku i podepnij oba widoki. Dwie kopie tego samego paska,
panelu czy kafelka **zawsze** się rozjeżdżają.

Ta sama rzecz ma się w całej aplikacji tak samo **nazywać**, tak samo **wyglądać** i tak samo **zachowywać**.

## 2. Przyciski: trzy rozmiary, dwa style

| rozmiar | wysokość | czcionka | gdzie |
|---|---|---|---|
| `large` | 40 px | `--text-base` 14 px | nagłówek aplikacji **i szuflada** — jedno i to samo, bez wyjątków |
| normalny (domyślny) | 34 px | `--text-sm` 13 px | paski narzędzi, strony, karty |
| `small` | 30 px | `--text-xs` 12 px | **wszystko wewnątrz popupów i okien**, wiersze paginacji |

Styl: **standard** (ciemna płytka) albo **accented** (`.primary`). `.danger` to nie trzeci styl, tylko czerwony hover
rzeczy nieodwracalnych.

- **Wszystkie przyciski w jednym równoległym układzie mają ten sam rozmiar i tę samą czcionkę.**
- **Maksymalnie jeden `.primary` na widok**; okno modalne i popup liczą się jako osobny widok.
- Nigdy nie rozciągaj przycisków na całą szerokość.
- Dotyczy **każdej klikalnej rzeczy z tekstem, która wywołuje akcję**: przycisków, `Select`, wyzwalaczy `Popover` i
  `MenuButton`, pozycji menu, chipów w rodzaju "Analizuj".
- Wyjątek: **rysowane kontrolki bez etykiety słownej** — komórka bidding boxa, macierz figur, wybór wtrącenia, numer
  strony. Ich treścią jest wartość, nie nazwa akcji.

## 3. Ikonki

- **Każdy przycisk z tekstem ma ikonkę SVG** — także w oknach, formularzach i na kartach. Ikonki są w
  `components/icons.tsx` (24 px box, `currentColor`, stroke 2.2). **Żadnych emoji.**
- **Każda pozycja menu komend ma ikonkę i jest wyrównana do lewej.** Nie dotyczy list wartości (`Select`).
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
- **Zawsze jedna linijka**, też na telefonie: `flex-wrap: nowrap`, a poniżej 560 px przyciski chowają słowa (etykieta
  zostaje w drzewie dostępności).
- Filtry i ustawienia w popupach, nie jako pola na pasku. Najwyżej jeden `.primary`.

## 5. Popupy, dropdowny, panele

- **Jeden komponent panelu dla wszystkich popupów.** Konto, znajomi, wybór systemu, skróty, wtrącenia, filtry,
  sortowanie — wszystko przechodzi przez ten sam komponent i ten sam arkusz. Pliki feature'owe dokładają **treść**, nie
  styl panelu.
- **W popupie jest dokładnie jedna czcionka: `--text-xs` (12 px).** Etykiety, pozycje list, przyciski, komentarze,
  nagłówki sekcji — wszystko. Wyjątkiem są liczniki i badge, które i tak są mniejsze. Dotyczy popupów z paska **i** z
  nagłówka: dwa panele obok siebie nie mogą mieć dwóch skal.
- Wszystkie przyciski w popupie to `small`.
- Pozycje list: do lewej, z ikonką (dla menu komend).

## 6. Gdzie wolno ustawiać styl kontrolki

**Wysokość, padding, `font-size`, `gap` i `align-items` klikalnych elementów żyją wyłącznie w jednym miejscu:**
`index.css` (przyciski) oraz wspólne arkusze kontrolek (`styles/toolbar.css`, `components/menu.css`, arkusz panelu).

Pliki widoków i feature'ów mogą ustawiać **tylko** kolor, tło, obramowanie, promień i położenie. Jeśli naprawdę trzeba
zrobić wyjątek (rysowane kontrolki z rozdziału 2), napisz nad nim komentarz z powodem — inaczej za tydzień nikt nie
odróżni wyjątku od niedopatrzenia.

## 7. Formularze, pola i etykiety

- **Nie stawiaj etykiety obok kontrolki w jednej linii** — etykieta stoi **nad** kontrolką.
- **Placeholder to przykład, nie instrukcja**: jedno słowo albo jedna wartość. Składnię wyjaśnia `HelpTip` przy etykiecie.
- Pola mają widoczną etykietę; sam placeholder nie jest etykietą.

## 8. Wspólne kontrolki

- Karta rozdania (`DealResultCard` + `deal.css`) jest **tą samą** kontrolką wszędzie.
- Odzywki i kontrakty rysuje wyłącznie `BidMark` / `SuitMark`.
- Nazwy i ikonki narzędzi biorą się z `tools/toolsRegistry.ts`.
- Listy rozdań składają się z części w `features/savedDeals/DealPieces.tsx`.

## 9. Paginacja

Pasek pod listą: `‹` + numery (okno pięciu wokół bieżącej) + `›`, przyciski `small`, bieżąca strona przez
`aria-current` i tło akcentu (nie `.primary` — to stan, nie komenda). Liczba na stronie i kolejność są w popupie
"Sortowanie".

## 10. Typografia, odstępy, kolory

- Rozmiary czcionek wyłącznie ze skali `--text-*`, odstępy ze skali `--space-*`.
- Nie zmieniaj czcionki, żeby coś się zmieściło — zmień układ.
- Znaki kolorów stoją na linii pisma; `SuitMark` nigdy bezpośrednio w kontenerze flex/grid. Pionowe wymiary znaku na
  pełne piksele (`--mark-box: 1em`).
- Cokolwiek leży w jednym wierszu, ma być idealnie wyrównane w pionie.

## 11. Jak sprawdzać (obowiązkowo po każdej zmianie UI)

Regresy z tej sesji wzięły się z trzech nawyków. Każdy ma tu swoje lekarstwo:

1. **Poprawiane było to, co na zrzucie, a nie cała klasa błędu.** Wyśrodkowany "Wyloguj" w szufladzie to ten sam błąd co
   wyśrodkowane pozycje menu, naprawiony wcześniej w innym pliku.
   → Po każdej zmianie reguły **wyszukaj wszystkie miejsca, których dotyczy**: `grep -rn "align-items|justify-content"`
   przy wyrównaniu, `grep -rn "font-size" --include=*.css` przy typografii, `grep -rn "<button" --include=*.tsx` przy
   przyciskach.
2. **Reguła w prozie, egzekwowanie w rozsypanych selektorach.** "Panel dziedziczy rozmiar po wyzwalaczu" działało dla
   `.menu-panel` i `.popover-panel`, a `.friends-panel` i `.picker-list` nigdy o tym nie słyszały.
   → Reguła ma mieć **jedno miejsce w kodzie** (rozdział 6). Jeśli nie da się jej tam zapisać, jest źle sformułowana.
3. **Liczby brane z ustaleń bez patrzenia na wynik.** 44 px / 16 px w nagłówku było zgodne z zapisem i wyglądało źle.
   → Po zmianie rozmiarów **powiedz użytkownikowi, co urosło lub zmalało**, i poproś o spojrzenie, zanim uznasz temat za
   zamknięty.

Lista kontrolna: rozmiary przycisków w każdym zmienionym układzie · ikonki · wyrównanie pozycji dropdownów · jeden akcent
na widok · pasek w jednej linijce · jedna czcionka w popupie · `tsc -b`, `eslint`, `vite build`.

Skill **`ui-ux-pro-max`** obowiązuje. Interfejs testuje użytkownik ręcznie — nie uruchamiaj przeglądarki.
