# Confidentialité de l’édition publique

CODEX · 24 novembre 2026

Le premier scan du dossier public/ ne relève aucun chemin personnel, adresse email ou motif de secret reconnu. Ce scan ne constitue pas une preuve absolue d’absence de secret ; il est complété par l’inspection des ressources et des métadonnées avant publication.

L’historique local contient les journaux privés et une adresse personnelle dans les métadonnées d’auteur. Il ne sera donc pas poussé sur le dépôt public. Il demeure intact sur le poste, avec ses commits et tags originaux. Aucun rebase destructif, filtre d’historique ou force push n’est effectué sur cet original.

Un dépôt de publication distinct est préparé dans .runtime/release-public/. Il contient des snapshots publics des quatre générations, leurs tags clairement documentés, puis l’édition publique. Les sources navigateur historiques sont conservées ; les journaux, métadonnées d’auteur privées, configurations d’agents et fichiers d’exécution sont exclus. Les commits publics utilisent une identité collective explicitement non personnelle. Leurs hashes diffèrent donc des commits privés : c’est une copie de publication, pas l’historique original.

Les documents publics sont sélectionnés et, si nécessaire, expurgés des chemins personnels. Les originaux locaux restent inchangés ; une note explique les expurgations. Les sources éditoriales identifient les journaux internes comme tels, sans les rendre téléchargeables par le serveur.

Le serveur ne sert que public/, ignore fichiers cachés et liens symboliques, interdit les mutations, et désactive caméra et microphone par en-têtes. Aucun analytics, compte, paiement, cookie de suivi ou stockage serveur n’est ajouté. Compositions, empreintes, langue et frise restent sur le navigateur.

Le retrait de fichiers privés ne doit pas être confondu avec une licence : la proposition MIT et le relevé des ressources sont documentés séparément. La gratuité de la visite est distincte des droits de réutilisation du code.
