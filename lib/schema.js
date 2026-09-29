module.exports = [
  {
    title: "Magasin",
    fields: [
      { key: "decideur", label: "Décide des achats et des fournisseurs" },
      { key: "clientele", label: "Clients que le système doit suivre" },
      { key: "clients_mois", label: "Clients gérés par mois" },
      { key: "utilisateurs", label: "Personnes qui utiliseront le système" },
    ],
  },
  {
    title: "Aujourd'hui",
    fields: [
      { key: "gestion_actuelle", label: "Gestion actuelle des clients" },
      { key: "echappe", label: "Ce qui échappe le plus" },
      { key: "si_rien", label: "Ce qui empire si rien ne change" },
    ],
  },
  {
    title: "Système",
    fields: [
      { key: "besoins", label: "Besoins dans le système" },
      { key: "besoins_autre", label: "Autre besoin" },
    ],
  },
  {
    title: "Développement",
    fields: [
      { key: "developpe", label: "Ce qui se développe en premier" },
      { key: "essayer", label: "Prêt à essayer le système" },
    ],
  },
  {
    title: "Prix",
    fields: [
      { key: "prix_mois", label: "Prix mensuel accepté pour cette gestion" },
      { key: "paiement", label: "Mode de paiement préféré" },
      { key: "commentaire", label: "Besoin précis à ajouter" },
      { key: "recontact", label: "Accepte d'être recontacté" },
      { key: "nom_magasin", label: "Nom du magasin" },
      { key: "contact_nom", label: "Nom" },
      { key: "telephone", label: "Téléphone" },
    ],
  },
];
