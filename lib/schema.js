module.exports = [
  {
    title: "Magasin",
    fields: [
      { key: "decideur", label: "Décide des achats et des fournisseurs" },
      { key: "gamme", label: "Vente principale" },
      { key: "clientele", label: "Clientèle principale" },
      { key: "anciennete", label: "Ancienneté du magasin" },
      { key: "effectif", label: "Personnes dans le magasin" },
    ],
  },
  {
    title: "Situation actuelle",
    fields: [
      { key: "source", label: "Où le magasin achète" },
      { key: "source_autre", label: "Autre source" },
      { key: "probleme", label: "Plus gros problème avec les fournisseurs" },
      { key: "probleme_autre", label: "Autre problème" },
      { key: "budget", label: "Budget d'achat mensuel" },
    ],
  },
  {
    title: "Intérêt",
    fields: [
      { key: "besoin", label: "A ce besoin aujourd'hui" },
      { key: "besoin_actuel", label: "Comment ce besoin est couvert aujourd'hui" },
      { key: "essayer", label: "Prêt à essayer cette offre" },
    ],
  },
  {
    title: "Prix",
    fields: [
      { key: "prix_doute", label: "Prix si bas que la qualité est douteuse", format: "dh" },
      { key: "prix_affaire", label: "Prix considéré comme une bonne affaire", format: "dh" },
      { key: "prix_cher", label: "Prix cher, mais encore acceptable", format: "dh" },
      { key: "prix_trop", label: "Prix trop cher, refus d'achat", format: "dh" },
      { key: "prix_max", label: "Maximum accepté par mois ou par commande", format: "dh" },
      { key: "paiement", label: "Mode de paiement préféré" },
    ],
  },
  {
    title: "Décision",
    fields: [
      { key: "changer", label: "Ce qui ferait changer de fournisseur" },
      { key: "changer_autre", label: "Autre raison de changer" },
      { key: "delai_decision", label: "Temps pour décider" },
      { key: "recontact", label: "Accepte d'être recontacté" },
      { key: "nom_magasin", label: "Nom du magasin" },
      { key: "contact_nom", label: "Nom" },
      { key: "telephone", label: "Téléphone" },
    ],
  },
];
