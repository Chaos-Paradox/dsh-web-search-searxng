/** Lower standard Remote decorators for Node runtimes that do not parse them yet. */
import ts from 'typescript'

export function lowerServiceDecorators() {
  return { name: 'lower-service-decorators', transform(code: string, id: string) {
    if (!id.endsWith('/runtime-service.ts')) return
    const output = ts.transpileModule(code, { fileName: id, compilerOptions: { target: ts.ScriptTarget.ES2024, module: ts.ModuleKind.ESNext, sourceMap: true } })
    return { code: output.outputText.replace(/\n?\/\/# sourceMappingURL=.*$/u, '\n'), map: output.sourceMapText }
  } }
}
