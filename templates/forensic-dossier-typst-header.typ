// Reusable Quarto/Typst header partial for "why {company} wants {candidate}" dossiers.
// Included via `format: typst: include-in-header:` in a companion .qmd.
// Case-file visual language: monospace metadata, serif headings, teal/violet brand accents.

#let dossier-teal = rgb("#0e6b7a")
#let dossier-navy = rgb("#0e2f38")
#let dossier-violet = rgb("#6a2f9e")
#let dossier-ink = rgb("#1a1a2e")
#let dossier-muted = rgb("#6b6b7a")
#let dossier-hairline = rgb("#d8dde6")

#set page(
  paper: "a4",
  margin: (top: 2.3cm, bottom: 2.1cm, left: 2.2cm, right: 2.2cm),
  header: context {
    if counter(page).get().first() > 1 {
      align(right, text(font: "IBM Plex Mono", size: 8pt, fill: dossier-muted, tracking: 0.5pt)[DOSSIER])
    }
  },
  footer: context {
    align(center, text(font: "IBM Plex Mono", size: 8pt, fill: dossier-muted)[
      Pagina #counter(page).display() van #context counter(page).final().at(0)
    ])
  }
)

#set text(font: "Inter", size: 10.8pt, fill: dossier-ink, lang: "nl")
#set par(justify: true, leading: 0.72em)

#show heading.where(level: 1): it => block(width: 100%, above: 1.2em, below: 0.8em)[
  #block(
    fill: dossier-navy,
    inset: (x: 14pt, y: 9pt),
    radius: 2pt,
    width: 100%,
  )[#text(font: "IBM Plex Serif", size: 14pt, weight: "bold", fill: white, tracking: 0.3pt)[#upper(it.body)]]
]

#show heading.where(level: 2): it => block(width: 100%, above: 1.1em, below: 0.5em)[
  #text(font: "IBM Plex Serif", size: 12.5pt, weight: "bold", fill: dossier-teal)[#it.body]
  #v(-0.55em)
  #line(length: 100%, stroke: 0.6pt + dossier-hairline)
]

#show heading.where(level: 3): it => text(font: "IBM Plex Serif", size: 11pt, weight: "bold", fill: dossier-ink)[#it.body]

#show link: it => text(fill: dossier-violet)[#it]
#show strong: it => text(weight: "bold", fill: dossier-navy)[#it]

#let case-stamp(case-no: "", subject: "", classification: "INTERN GEBRUIK", date: "") = {
  block(
    stroke: 0.8pt + dossier-teal,
    inset: 14pt,
    radius: 3pt,
    width: 100%,
    fill: rgb("#f3f9fa"),
  )[
    #grid(
      columns: (1fr, 1fr),
      row-gutter: 10pt,
      column-gutter: 12pt,
      [#text(font: "IBM Plex Mono", size: 8pt, fill: dossier-muted, tracking: 1pt)[CASE NR.] \
       #text(font: "IBM Plex Mono", size: 14pt, weight: "bold", fill: dossier-navy)[#case-no]],
      [#text(font: "IBM Plex Mono", size: 8pt, fill: dossier-muted, tracking: 1pt)[CLASSIFICATIE] \
       #text(font: "IBM Plex Mono", size: 9.5pt, weight: "bold", fill: dossier-violet)[#classification]],
      [#text(font: "IBM Plex Mono", size: 8pt, fill: dossier-muted, tracking: 1pt)[ONDERWERP] \
       #text(size: 10.5pt, weight: "bold")[#subject]],
      [#text(font: "IBM Plex Mono", size: 8pt, fill: dossier-muted, tracking: 1pt)[DATUM] \
       #text(size: 10.5pt)[#date]],
    )
  ]
}

#let verdict-box(body) = {
  block(
    fill: rgb("#faf5ff"),
    stroke: (left: 3pt + dossier-violet),
    inset: (left: 14pt, top: 10pt, bottom: 10pt, right: 14pt),
    width: 100%,
  )[#body]
}

#let risk-box(body) = {
  block(
    fill: rgb("#fffaf0"),
    stroke: (left: 3pt + rgb("#b8860b")),
    inset: (left: 14pt, top: 10pt, bottom: 10pt, right: 14pt),
    width: 100%,
  )[#body]
}

#let case-closure(case-no: "", ref: "", researcher: "") = {
  v(0.6cm)
  line(length: 100%, stroke: 0.6pt + dossier-hairline)
  v(0.4cm)
  block(
    stroke: 0.8pt + dossier-hairline,
    inset: 12pt,
    radius: 3pt,
    width: 100%,
    fill: rgb("#fafbfc"),
  )[
    #grid(
      columns: (1fr, 1fr, 1fr),
      column-gutter: 10pt,
      [#text(font: "IBM Plex Mono", size: 8pt, fill: dossier-muted, tracking: 1pt)[DOSSIER STATUS] \
       #text(font: "IBM Plex Mono", size: 9.5pt, weight: "bold", fill: dossier-teal)[AFGESLOTEN]],
      [#text(font: "IBM Plex Mono", size: 8pt, fill: dossier-muted, tracking: 1pt)[CASE NR. / REF] \
       #text(font: "IBM Plex Mono", size: 9.5pt, weight: "bold")[#case-no — #ref]],
      [#text(font: "IBM Plex Mono", size: 8pt, fill: dossier-muted, tracking: 1pt)[SAMENGESTELD DOOR] \
       #text(size: 9.5pt)[#researcher]],
    )
  ]
}
