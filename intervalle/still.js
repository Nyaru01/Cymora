// INTERVALLE — politique triviale de test : elle ne fait rien et se repose.
// Sert à essayer sa propre politique seul, sans lire celle de l'autre. Auteur : CLAUDE.
export function createPolicy() {
  return { name: 'IMMOBILE', act: () => ({ rest: true }) };
}
