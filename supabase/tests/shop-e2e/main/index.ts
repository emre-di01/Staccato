Deno.serve(async (req: Request) => {
  const name = new URL(req.url).pathname.split('/').filter(Boolean).pop()
  const w = await EdgeRuntime.userWorkers.create({ servicePath: `/fn/${name}`, memoryLimitMb: 256, workerTimeoutMs: 60000, noModuleCache: false, importMapPath: null, envVars: Object.entries(Deno.env.toObject()), forceCreate: false })
  return await w.fetch(req)
})
