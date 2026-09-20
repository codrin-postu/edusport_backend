#!/usr/bin/env python3
"""
Builds the client-facing data collection workbook.

One sheet per content type the CMS actually stores, one row per record, so the
client can type straight into it and we can import without reshaping anything.

Deliberate choices for usability:
  - no merged cells anywhere in a data area (they break tab-through entry and
    sorting, and Google Sheets handles them badly on import)
  - the header row is frozen and auto-filtered
  - row 2 is a greyed EXEMPLU row showing the expected format, not real data
  - dropdowns via data validation where a field has a fixed set of answers
  - notes live in a comment on the header cell, so they never occupy a row
"""

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.comments import Comment
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.utils import get_column_letter

OUT = "date-necesare-edusport.xlsx"

INK = "1C1D22"
ACCENT = "1F4FD8"
HEAD_BG = "E8EDFB"
EX_TXT = "8A8E99"
BAND = "F7F8FB"

thin = Side(style="thin", color="DDDDE2")
BORDER = Border(left=thin, right=thin, top=thin, bottom=thin)


def sheet(wb, title, cols, example, note=None, rows=40):
    """cols: list of (header, width, help_text, dropdown|None)"""
    ws = wb.create_sheet(title)
    if note:
        ws["A1"] = note
        ws["A1"].font = Font(size=10, italic=True, color=EX_TXT)
        ws["A1"].alignment = Alignment(vertical="center")
        ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=len(cols))
        ws.row_dimensions[1].height = 26
        head_row = 2
    else:
        head_row = 1

    for i, (header, width, help_text, dropdown) in enumerate(cols, start=1):
        c = ws.cell(row=head_row, column=i, value=header)
        c.font = Font(bold=True, size=11, color=INK)
        c.fill = PatternFill("solid", fgColor=HEAD_BG)
        c.alignment = Alignment(vertical="center", wrap_text=True)
        c.border = BORDER
        if help_text:
            cm = Comment(help_text, "EduSport")
            cm.width, cm.height = 260, 90
            c.comment = cm
        ws.column_dimensions[get_column_letter(i)].width = width

        if dropdown:
            dv = DataValidation(
                type="list",
                formula1='"' + ",".join(dropdown) + '"',
                allow_blank=True,
                showDropDown=False,
            )
            ws.add_data_validation(dv)
            dv.add(f"{get_column_letter(i)}{head_row+2}:{get_column_letter(i)}{head_row+rows}")

    ws.row_dimensions[head_row].height = 30

    ex_row = head_row + 1
    for i, val in enumerate(example, start=1):
        c = ws.cell(row=ex_row, column=i, value=val)
        c.font = Font(size=10, italic=True, color=EX_TXT)
        c.fill = PatternFill("solid", fgColor=BAND)
        c.alignment = Alignment(vertical="top", wrap_text=True)
        c.border = BORDER

    for r in range(ex_row + 1, ex_row + 1 + rows):
        for i in range(1, len(cols) + 1):
            c = ws.cell(row=r, column=i)
            c.border = BORDER
            c.alignment = Alignment(vertical="top", wrap_text=True)

    ws.freeze_panes = ws.cell(row=ex_row, column=1)
    ws.auto_filter.ref = f"A{head_row}:{get_column_letter(len(cols))}{ex_row+rows}"
    return ws


DA_NU = ["Da", "Nu"]
NOTE_EX = "Randul gri este doar un exemplu de format. Sterge-l sau scrie peste el."

wb = Workbook()

# ---------------------------------------------------------------- start here
ws = wb.active
ws.title = "Start aici"
ws.column_dimensions["A"].width = 34
ws.column_dimensions["B"].width = 78

ws["A1"] = "Date necesare pentru site-ul EduSport"
ws["A1"].font = Font(bold=True, size=18, color=INK)
ws["A3"] = ("Fiecare fila de mai jos este o lista. Scrie un rand pentru fiecare "
            "antrenor, sportiv, concurs si asa mai departe.")
ws["A3"].font = Font(size=11)
ws.merge_cells("A3:B3")

rows = [
    ("Cum completezi", "Scrii direct in tabel, un rand pentru fiecare inregistrare. "
                       "Primul rand gri este un exemplu de format, il poti sterge."),
    ("Nu stiu ce se cere", "Treci cu mouse-ul peste titlul coloanei. Are o nota cu explicatia."),
    ("Nu am toate datele", "Lasa gol si trimite ce ai. Completam pe parcurs."),
    ("Fotografii", "Nu se pun in Excel. Le urci intr-un folder si scrii numele "
                   "fisierului in coloana potrivita."),
    ("Acordul parintilor", "Pentru orice poza in care apare un copil ne trebuie acordul "
                           "scris al parintelui. Fara acord nu putem publica poza."),
    ("Ordinea recomandata", "Despre club, Echipa, Grupe si program, Preturi, Contact, "
                            "apoi Sportivi, Concursuri, Parteneri."),
]
r = 5
for k, v in rows:
    a = ws.cell(row=r, column=1, value=k)
    a.font = Font(bold=True, size=11, color=ACCENT)
    a.alignment = Alignment(vertical="top")
    b = ws.cell(row=r, column=2, value=v)
    b.alignment = Alignment(vertical="top", wrap_text=True)
    ws.row_dimensions[r].height = 34
    r += 2

ws.cell(row=r + 1, column=1, value="Filele din acest fisier").font = Font(bold=True, size=12)
r += 2
tabs = [
    ("Despre club", "Anul infiintarii, numar de elevi, text de prezentare"),
    ("Istoric", "Momentele importante, cate un rand pe an"),
    ("Echipa", "Antrenori, asistenti, restul echipei"),
    ("Sportivi", "Sportivii care apar public pe site"),
    ("Concursuri", "Concursurile la care a participat clubul"),
    ("Rezultate", "Ce loc a luat fiecare sportiv la fiecare concurs"),
    ("Parteneri", "Parteneri si sponsori"),
    ("Evenimente parteneri", "Evenimente organizate impreuna cu ei"),
    ("Grupe si program", "Grupele si orele de antrenament"),
    ("Preturi", "Abonamente si reduceri"),
    ("Contact", "Telefon, email, adresa, social media"),
    ("Fotografii", "Ce poze ne trebuie si de unde"),
    ("Intrebari frecvente", "Ce va intreaba parintii cel mai des"),
]
for name, desc in tabs:
    ws.cell(row=r, column=1, value=name).font = Font(bold=True, size=10.5)
    ws.cell(row=r, column=2, value=desc).font = Font(size=10.5, color=EX_TXT)
    r += 1

# ---------------------------------------------------------------- despre club
ws = wb.create_sheet("Despre club")
ws.column_dimensions["A"].width = 46
ws.column_dimensions["B"].width = 62
ws.column_dimensions["C"].width = 16
hdr = [("Intrebare", 46), ("Raspunsul tau", 62), ("Obligatoriu", 16)]
for i, (h, w) in enumerate(hdr, start=1):
    c = ws.cell(row=1, column=i, value=h)
    c.font = Font(bold=True, size=11, color=INK)
    c.fill = PatternFill("solid", fgColor=HEAD_BG)
    c.border = BORDER
ws.row_dimensions[1].height = 24
ws.freeze_panes = "A2"

qs = [
    ("In ce an a inceput scoala de patinaj?", "Da"),
    ("Cum a inceput? Pe scurt, cateva randuri.", "Nu"),
    ("Cati elevi au trecut prin club de la inceput pana acum? O estimare este suficienta.", "Da"),
    ("Cati elevi sunt in sezonul acesta?", "Da"),
    ("Cati antrenori sunt acum?", "Da"),
    ("Cati asistenti sunt acum?", "Da"),
    ("Text de prezentare a clubului, cinci sau sase randuri.", "Da"),
    ("Numele patinoarului unde se fac antrenamentele", "Da"),
    ("Adresa patinoarului", "Da"),
    ("Denumirea juridica completa a clubului", "Nu"),
    ("Cod fiscal / CIF", "Nu"),
    ("Culorile oficiale ale clubului, daca exista", "Nu"),
    ("Numele fisierului cu logo-ul clubului", "Da"),
    ("Exista un anunt care ar trebui afisat acum pe site?", "Nu"),
    ("Cum putem ajuta clubul? Pentru pagina de voluntariat.", "Nu"),
]
for idx, (q, must) in enumerate(qs, start=2):
    ws.cell(row=idx, column=1, value=q).alignment = Alignment(wrap_text=True, vertical="top")
    ws.cell(row=idx, column=2).alignment = Alignment(wrap_text=True, vertical="top")
    ws.cell(row=idx, column=3, value=must).alignment = Alignment(horizontal="center")
    for i in range(1, 4):
        ws.cell(row=idx, column=i).border = BORDER
    ws.row_dimensions[idx].height = 30

# ---------------------------------------------------------------- the lists
sheet(wb, "Istoric",
      [("An", 10, "Anul in care s-a intamplat.", None),
       ("Titlu scurt", 34, "Cateva cuvinte. Apare ingrosat pe site.", None),
       ("Descriere", 68, "Doua sau trei randuri despre ce s-a intamplat.", None)],
      ["2015", "Infiintarea clubului",
       "Primul grup de 12 copii, antrenamente de doua ori pe saptamana."],
      NOTE_EX)

sheet(wb, "Echipa",
      [("Nume complet", 28, "Asa cum vrea persoana sa apara public pe site.", None),
       ("Functia exacta", 26,
        "Titlul real, nu unul aproximativ. De exemplu antrenor principal, antrenor secund, "
        "asistent, coregraf, preparator fizic, kinetoterapeut.", None),
       ("Grupele de care se ocupa", 26, "Incepatori, avansati, performanta, sau numele grupei.", None),
       ("Descriere", 54, "Trei sau patru randuri. Experienta, certificari, ce preda.", None),
       ("Din ce an e in club", 18, "Optional.", None),
       ("Nume fisier poza", 26, "Portret. Scrie doar numele fisierului din folderul de poze.", None),
       ("Apare pe site", 14, "Da sau Nu.", DA_NU)],
      ["Maria Ionescu", "Antrenor principal", "Avansati, performanta",
       "Antrenoare cu 12 ani de experienta, fosta sportiva de performanta.",
       "2016", "maria-ionescu.jpg", "Da"],
      NOTE_EX)

sheet(wb, "Sportivi",
      [("Nume", 24, "Numele sportivului.", None),
       ("Apare public pe site", 18, "Da sau Nu. Pentru minori ne trebuie acordul parintelui.", DA_NU),
       ("Acord parinte semnat", 18, "Da sau Nu. Obligatoriu pentru minori.", DA_NU),
       ("Din ce an patineaza aici", 20, "Anul.", None),
       ("Disciplina", 22, "Patinaj artistic, dans pe gheata, altele.", None),
       ("Descriere scurta", 46, "Doua sau trei randuri.", None),
       ("Povestea lui", 60, "Text mai lung. Cum a inceput, ce il motiveaza. Optional.", None),
       ("Elemente preferate", 30, "De exemplu axel, pirueta, combinatie. Separate prin virgula.", None),
       ("Hobby-uri", 26, "In afara patinajului. Separate prin virgula.", None),
       ("Antrenor", 22, "Cine il antreneaza.", None),
       ("Coregraf", 22, "Daca are.", None),
       ("Obiectiv sezon", 34, "Ce isi propune anul acesta. Optional.", None),
       ("Nume fisier portret", 24, "O poza de portret.", None),
       ("Nume fisiere poze concurs", 40, "Trei pana la opt poze. Separate prin virgula.", None)],
      ["Ana Popescu", "Da", "Da", "2019", "Patinaj artistic",
       "Patineaza de la 6 ani, componenta grupei de performanta.",
       "A inceput dupa ce a vazut un concurs la televizor.",
       "Axel, pirueta sus", "Desen, inot", "Maria Ionescu", "Radu Enache",
       "Calificare la nationale", "ana-popescu.jpg",
       "ana-brasov-1.jpg, ana-brasov-2.jpg"],
      NOTE_EX)

sheet(wb, "Concursuri",
      [("Numele concursului", 34, "Denumirea oficiala.", None),
       ("Data", 16, "Ziua sau perioada. De exemplu 14.12.2025.", None),
       ("Oras", 20, "Unde s-a tinut.", None),
       ("Patinoar / locatie", 28, "Numele locatiei.", None),
       ("Nivel", 18, "Local, national sau international.",
        ["Local", "National", "International"]),
       ("Sezon", 16, "De exemplu 2025-2026.", None),
       ("Sportivi participanti", 40, "Numele sportivilor din club. Separate prin virgula.", None),
       ("Nume fisiere poze", 36, "Poze de la concurs. Separate prin virgula.", None)],
      ["Cupa Brasovului", "14.12.2025", "Brasov", "Patinoarul Olimpia", "National",
       "2025-2026", "Ana Popescu, Mihai Radu", "brasov-1.jpg, brasov-2.jpg"],
      NOTE_EX)

sheet(wb, "Rezultate",
      [("Concurs", 32, "Acelasi nume ca in fila Concursuri.", None),
       ("Sportiv", 24, "Numele sportivului.", None),
       ("Categorie", 24, "Categoria de varsta sau nivel la care a concurat.", None),
       ("Loc ocupat", 14, "Cifra. Lasa gol daca nu s-a clasat.", None),
       ("Punctaj", 14, "Daca il aveti.", None),
       ("Mentiune", 34, "Orice altceva merita spus. Optional.", None)],
      ["Cupa Brasovului", "Ana Popescu", "Juniori mici", "2", "42.15",
       "Cel mai bun punctaj personal"],
      NOTE_EX)

sheet(wb, "Parteneri",
      [("Nume partener", 30, "Cum se numeste firma sau organizatia.", None),
       ("Tip", 18, "Partener sau sponsor.", ["Partener", "Sponsor"]),
       ("Adresa site", 34, "Linkul catre site-ul lor.", None),
       ("Nume fisier logo", 26, "Logo-ul lor, in cea mai buna calitate.", None),
       ("Avem acordul sa il afisam", 22, "Da sau Nu.", DA_NU),
       ("Ordine afisare", 16, "1 pentru primul afisat. Optional.", None)],
      ["Numele firmei", "Sponsor", "https://exemplu.ro", "logo-exemplu.png", "Da", "1"],
      NOTE_EX)

sheet(wb, "Evenimente parteneri",
      [("Titlul evenimentului", 32, "Cum s-a numit.", None),
       ("Partener", 26, "Cu cine a fost organizat.", None),
       ("Data", 16, "De exemplu 14.12.2025.", None),
       ("Descriere", 56, "Doua sau trei randuri despre ce a fost.", None),
       ("Nume fisier poza", 26, "Cel putin o poza.", None)],
      ["Cupa de iarna", "Numele firmei", "14.12.2025",
       "Concurs demonstrativ pentru grupele de incepatori, 40 de participanti.",
       "cupa-iarna-2025.jpg"],
      NOTE_EX)

sheet(wb, "Grupe si program",
      [("Numele grupei", 26, "Cum ii spuneti.", None),
       ("Nivel sau varsta", 24, "Incepatori, avansati, sau intervalul de varsta.", None),
       ("Zilele", 26, "De exemplu Luni, Miercuri.", None),
       ("Ora de inceput", 16, "De exemplu 10:00.", None),
       ("Ora de final", 16, "De exemplu 10:50.", None),
       ("Cati copii incap", 16, "Numar maxim.", None),
       ("Antrenor", 24, "Cine tine grupa.", None)],
      ["Incepatori 1", "5-7 ani", "Luni, Miercuri", "10:00", "10:50", "12", "Maria Ionescu"],
      NOTE_EX)

sheet(wb, "Preturi",
      [("Numele abonamentului", 28, "Cum apare pe site.", None),
       ("Ce include", 52, "Cate sedinte, ce grupe, ce altceva intra in pret.", None),
       ("Pret", 16, "Suma in lei.", None),
       ("Perioada", 20, "Pe luna, pe sezon, pe sedinta.",
        ["Pe sedinta", "Pe luna", "Pe sezon"]),
       ("Reducere", 34, "De exemplu pentru frati sau plata integrala. Optional.", None)],
      ["Abonament lunar incepatori", "8 sedinte pe luna, grupa de incepatori", "350",
       "Pe luna", "10% pentru al doilea copil"],
      NOTE_EX, rows=25)

ws = wb.create_sheet("Contact")
ws.column_dimensions["A"].width = 40
ws.column_dimensions["B"].width = 62
for i, h in enumerate(["Ce", "Raspunsul tau"], start=1):
    c = ws.cell(row=1, column=i, value=h)
    c.font = Font(bold=True, size=11, color=INK)
    c.fill = PatternFill("solid", fgColor=HEAD_BG)
    c.border = BORDER
ws.freeze_panes = "A2"
contact = ["Telefon", "Adresa de e-mail (aici ajung inscrierile)", "Adresa fizica",
           "Pagina de Facebook", "Pagina de Instagram", "Alt cont de social media",
           "Cine raspunde la mesajele de pe site",
           "Perioada de inscrieri: de cand", "Perioada de inscrieri: pana cand",
           "Ce trebuie sa aiba copilul la prima sedinta",
           "Exista un regulament semnat de parinti? Numele fisierului."]
for idx, k in enumerate(contact, start=2):
    ws.cell(row=idx, column=1, value=k).alignment = Alignment(wrap_text=True, vertical="top")
    ws.cell(row=idx, column=2).alignment = Alignment(wrap_text=True, vertical="top")
    for i in (1, 2):
        ws.cell(row=idx, column=i).border = BORDER
    ws.row_dimensions[idx].height = 26

sheet(wb, "Fotografii",
      [("Unde apare pe site", 30, "La ce sectiune se foloseste.", None),
       ("Ce ne trebuie", 46, "Ce fel de poze.", None),
       ("Cate", 14, "Numar orientativ.", None),
       ("Le aveti", 14, "Da, Nu, sau Partial.", ["Da", "Nu", "Partial"]),
       ("Unde sunt", 34, "Numele folderului sau linkul.", None)],
      ["Prima pagina", "Poze orizontale de la antrenamente sau concursuri", "5-10",
       "Partial", "Drive / Poze site"],
      "Nu pune pozele in Excel. Urca-le intr-un folder pe Drive sau WeTransfer si scrie "
      "aici unde sunt. Trimite originalele, nu prin WhatsApp, ca pierd calitatea.",
      rows=14)
wsf = wb["Fotografii"]
preset = [
    ("Prima pagina", "Poze orizontale de la antrenamente sau concursuri", "5-10"),
    ("Pagina de echipa", "Cate un portret pentru fiecare antrenor si asistent", "cati sunt"),
    ("Pagina fiecarui sportiv", "Un portret plus poze de la concursuri", "3-8 per sportiv"),
    ("Concursuri", "Poze de grup, premieri, momente din concurs", "cate aveti"),
    ("Evenimente cu parteneri", "Cel putin o poza pentru fiecare eveniment", "1+ per eveniment"),
    ("Patinoar", "Locul unde se fac antrenamentele", "3-5"),
    ("Logo", "Logo-ul clubului in cea mai buna calitate", "1"),
]
for i, (a, b, c) in enumerate(preset, start=4):
    wsf.cell(row=i, column=1, value=a)
    wsf.cell(row=i, column=2, value=b)
    wsf.cell(row=i, column=3, value=c)
    for col in range(1, 6):
        wsf.cell(row=i, column=col).alignment = Alignment(wrap_text=True, vertical="top")

sheet(wb, "Intrebari frecvente",
      [("Intrebarea", 46, "Cum o pun parintii de obicei.", None),
       ("Raspunsul", 70, "Cum raspundeti.", None)],
      ["De la ce varsta poate incepe un copil?",
       "De la 4 ani, in grupa de initiere."],
      NOTE_EX, rows=20)

wb.save(OUT)
print("scris:", OUT)
for s in wb.sheetnames:
    print("  fila:", s)
