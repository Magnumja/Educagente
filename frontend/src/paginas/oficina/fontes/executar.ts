/**
 * Contrato da função executar() que a etapa 2 (Fontes.tsx) passa para as partes dela.
 * Cada ação recebe uma chave para o botão certo mostrar "carregando":
 * 's<id>' usar sugerida, 'r<id>' remover, 'arquivo' enviar arquivo, 'texto' colar texto.
 */
export type Executar = (chave: string, acao: () => Promise<unknown>, sucesso: string) => Promise<void>
