# AI-MAZE – spelspecifikation

## 1. Översikt

AI-MAZE är ett enspelarspel för Philips Videopac G7000/Magnavox
Odyssey². Spelaren ska dra en sammanhängande linje genom en labyrint och
besöka samtliga 42 rutor exakt en gång.

Målplattformen är en PAL-baserad Videopac G7000 med standard-BIOS. Spelet
levereras som en 4 KiB ROM och använder samma typ av XROM-dataåtkomst som
Videopac 31 och 40.

## 2. Spelregler

- Spelplanen består av ett rutnät på 7 × 6 rutor.
- Markören börjar på en förutbestämd startruta för aktuell bana.
- Ett drag får bara göras genom en öppen passage till en ortogonalt
  angränsande ruta.
- En redan besökt ruta får inte besökas igen.
- Banan är klar när samtliga 42 rutor har besökts.
- Ett ogiltigt drag ignoreras och påverkar inte poängen.
- Joystickknappen startar om aktuell bana och sänker banans möjliga poäng
  med fem, dock aldrig under 10 poäng.

## 3. Kontroller

- Joystick 1 upp, höger, ned och vänster flyttar markören.
- Ett nytt drag accepteras först efter att joysticken återgått till
  neutralläge. Detta förhindrar oavsiktlig repetition.
- Joystick 1:s knapp startar om aktuell bana.

## 4. Nivåval och progression

- Spelet använder BIOS-rutinen `SELECT GAME` med dess normala bild och ljud.
- Enter på `SELECT GAME` startar nivå 1 omedelbart.
- Nivå 1–9 väljs med en siffra och startar efter cirka tre sekunders timeout.
- Mellanslag efter den första siffran bekräftar en ensiffrig nivå omedelbart;
  exempelvis startar `1` följt av mellanslag nivå 1 utan timeout.
- Nivå 01–09 kan också anges med två siffror och startar direkt.
- Nivå 10–31 väljs med två siffror och startar direkt efter den andra siffran.
- Övriga tal är ogiltiga och återgår till `SELECT GAME`.
- Efter avklarad nivå 1–30 spelas slutfirandet och nästa nivå laddas.
- Nivå 31 är slutnivån och ligger kvar efter att den klarats.
- Vid en direktstart nollställs totalpoängen och den valda banan börjar åter
  med ett värde på 100 poäng.

## 5. Banor

Spelet innehåller 31 deterministiskt genererade banor. Alla banor ska:

- vara lösbara;
- ha exakt en lösning från angiven startruta;
- använda alla 42 rutor;
- innehålla vilseledande passager och meningsfulla vägval;
- uppfylla generatorns minimikrav för söktillstånd, fällor och spridning.

Generatorn sorterar fram svåra banor från en större kandidatpool. De 31
utvalda banorna ordnas därefter efter generatorns sammansatta
svårighetsvärde: nivå 1 är den lättaste i urvalet och nivå 31 den svåraste.
Samtliga nivåer ska fortfarande klara det höga minimikravet.

### 5.1 Binärt banformat

Varje bana använder 22 byte:

| Offset | Storlek | Innehåll |
| --- | ---: | --- |
| 0 | 1 byte | Startruta, 0–41 |
| 1 | 21 byte | Två fyrabitars rörelsemasker per byte |

Rörelsemaskens bitar är `1=upp`, `2=höger`, `4=ned` och `8=vänster`.
Filen `roms/levels_31_7x6.bin` ska därför alltid vara 31 × 22 = 682 byte.
Gridväggarna skapas från rörelsemaskerna när en bana laddas, så synliga
väggar och tillåtna rörelser använder alltid samma datakälla.

XROM-läsaren måste läsa aktuell byte innan adresspekaren ökas. Detta är
nödvändigt när någon bandel passerar en `$xxFF/$xx00`-gräns.

## 6. Poäng

Poängen lagras och visas som fyrsiffrig packed BCD.

En bana ger 100 poäng om den klaras utan omstart. Varje omstart sänker
banans poäng med fem: 95, 90, 85 och så vidare. Poängen har ett golv på 10,
så en avklarad bana ger alltid minst 10 poäng. Ogiltiga rörelser påverkar
inte poängen.

Poängens fyra siffror och nivåns två siffror visas kontinuerligt längst ned
med VDC:ns quad-objekt. Inget kolon ska visas mellan poängsiffrorna.
Poängens två sammanflätade quads börjar vid X-position `$20`; nivåvisningen
har kvar sin separata placering.

## 7. Grafik och layout

- Bakgrunden är svart.
- Labyrintväggarna är normalt klargula och byggs med VDC:ns grid-funktion.
- Besökta rutor visas med cyan fyllnadssymbol.
- Aktuell ruta visas vit och markeras dessutom med en vit diamantsprite.
- Hela labyrinten är placerad en gridrad längre ned än den ursprungliga
  prototypen.
- 7×6-spelplanen börjar vid gridkolumn 1 och är flyttad en kolumn åt vänster
  jämfört med den första 7×6-prototypen.
- Fyllnadssymbolerna och den vita markören har en gemensam X-bas på `$1D`,
  en bildpunkt åt höger om gridens ursprung, för optisk centrering i rutorna.
- Rubriken `AI-MAZE` visas ovanför labyrinten, uppflyttad och förskjuten åt vänster.
- Bokstäverna använder samma 16-stegsavstånd. Bindestrecket ligger mellan
  `I` och `M`.

### 7.1 VDC-objekt

| Resurs | Användning |
| --- | --- |
| Tecken 0–4 | Bokstäverna `AIMAZ` |
| Tecken 5–11 | Rastermultiplexade fyllnadssymboler för 42 rutor |
| Sprite 0 | Diamantmarkör |
| Sprite 1 | Bindestrecket i `AI-MAZE` |
| Sprite 2 | Bokstaven `E` i `AI-MAZE` |
| Quad 0–1 | Fyra poängsiffror, interfolierade |
| Quad 2–3 | Två nivåsiffror |

Tecken 5–11 återanvänds på sex rasterrader via timeravbrott. Ändringar i
denna rutin måste behålla jämn exekveringstid för tomma, besökta och aktuella
rutor. Formpekarens höga bit i teckenattributet får aldrig skrivas över av
en färgändring.

## 8. Ljud och slutfirande

- BIOS-standardljudet ska spelas på `SELECT GAME`.
- Övergången från `SELECT GAME` till själva spelet ska vara tyst.
- Förflyttning, ogiltiga drag och manuell omstart ska inte ge ljud.
- När en bana klaras spelas den välbekanta sekvensen med fem toner från BIOS
  `SELECT GAME` som fem separata tonblock.
- Under de fem tonblocken ändrar väggar och fyllnadssymboler färg, men
  symbolernas form får aldrig ändras.

Firandets färgpar är:

| Ton | Väggar | Symboler/markör |
| ---: | --- | --- |
| 1 | Grön | Röd |
| 2 | Röd | Gul |
| 3 | Gul | Blå |
| 4 | Blå | Grön |
| 5 | Brun, mörk gul grid | Röd |

VDC-tecken och sprites kan bara använda ljusa färger. Brun används därför
endast för grid-väggarna genom gul utan intensitetsbit.

## 9. Minnes- och ROM-layout

| Område | Användning |
| --- | --- |
| `$0000–$02A9` | 31 banposter i XROM, totalt 682 byte |
| `$0400–$0B9F` | Programkod och fasta kodblock med interna luckor |
| `$0BFF` | Slutmarkör |
| `$0C00–$0C73` | Rutinen som skapar gridväggar från rörelsemasker |
| `$0C80–$0CA5` | Startdispatcher för nivåval och direktstart med Enter |

ROM-filen ska vara exakt 4096 byte. Det finns 342 lediga byte mellan
bandata och kod samt 870 lediga byte efter gridrutinen och startdispatchern.
Därtill finns luckor mellan
vissa fasta `org`-sektioner. Intern RAM `$27–$2C` är
för närvarande ledigt, men BIOS-reserverade `$3D–$3F` får inte användas.

Extern RAM används så här:

- `$00–$29`: 42 bytes visningsstatus, `0=tom`, `1=besökt`, `2=aktuell`;
- `$2A–$53`: 42 bytes rörelsemasker.

## 10. Bygge och körning

Bygg från projektkatalogen med:

```text
build_maze_line_42.cmd
```

Bygget ska:

1. generera och verifiera 31 banor;
2. skapa `roms/levels_31_7x6.bin` och `roms/levels_31_7x6.txt`;
3. assemblera en 4096 byte stor ROM;
4. skriva `roms/ai-maze-42-31levels.rom`.

Startskriptet `run_7x6_o2em118.cmd` pekar på 7×6-versionens 31-banors-ROM.
Referensemulatorn är O2EM 1.18 i PAL-läge med europeisk
G7000-BIOS.

## 11. Acceptanskriterier och regressionstest

- `SELECT GAME` visas korrekt och spelar endast BIOS-standardljudet.
- Nivå 1–9 startar efter timeout; 10–31 startar efter två tangenttryckningar.
- Mellanslag bekräftar nivå 1–9 direkt efter den första siffran.
- Båda nivåsiffrorna och alla fyra poängsiffrorna syns hela tiden.
- `AI-MAZE` syns komplett utan att skriva över nivå eller poäng.
- Samtliga 31 banor kan direktstartas och är unikt lösbara.
- Bandata läses korrekt över samtliga XROM-gränser `$xxFF/$xx00`.
- Inga väggsegment visas utanför labyrintens yttergränser.
- Fyllnadssymbolerna visas korrekt på alla sex rader utan blinkning,
  klippning eller byte till bokstäver som `W`.
- Efter en löst bana 1–30 ökar nivånumret och nästa banpost laddas.
- Ingen kontinuerlig ton hörs när spelet startar eller under normal spelgång.
- Vid manuell omstart får ingen tillfällig vit symbol visas i övre vänstra
  rutan; rastertimern ska vara avstängd medan bandata byggs om.
- Slutmelodin har fem tonblock och färgsekvensen följer varje ton.
- ROM-filen är exakt 4096 byte och `levels_31_7x6.bin` exakt 682 byte.

## 12. Viktiga projektfiler

- `maze_line_42.a48` – Intel 8048-källkod.
- `tools/assemble.js` – lokal tvåpassassembler för använd MCS-48-deluppsättning.
- `tools/generate_maze_levels_42.js` – deterministisk nivågenerator.
- `tools/verify_maze_levels_42.js` – fristående struktur- och lösningsverifierare.
- `build_maze_line_42.cmd` – komplett byggflöde.
- `run_7x6_o2em118.cmd` – start av 7×6-ROM i O2EM 1.18.
- `roms/levels_31_7x6.txt` – generatorrapport och lösningsväg per bana.
- `roms/ai-maze-42-31levels.rom` – färdig spel-ROM.
