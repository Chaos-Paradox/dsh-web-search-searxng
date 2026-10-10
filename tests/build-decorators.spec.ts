import { expect, it } from 'vitest'
import { lowerServiceDecorators } from '../build/decorators.ts'

it.each(['/project/src/runtime-service.ts', String.raw`D:\project\src\runtime-service.ts`])(
  'emits Node-parseable service decorators for %s', id => {
    const output = lowerServiceDecorators().transform('function Remote() {}\nclass Service { @Remote status() { return 1 } }', id)
    expect(output?.code).not.toContain('@Remote')
    expect(output?.code).toContain('__esDecorate')
    expect(() => new Function(output!.code)).not.toThrow()
  },
)
