## Why

<!-- Operator-visible change. One sentence. -->

## What

-

## Firmware rules

- [ ] Does not widen permissions in a lower policy layer
- [ ] No global autonomy switch
- [ ] Auth stays OFF unless this change explicitly adds accounts
- [ ] Production execution stays disabled
- [ ] Behavioral kernel changes include evals **and** an operator simulation
- [ ] `npm test`, `npm run typecheck`, `npm run lint`, `npm run check:auth` (with `npm run dev` running in another terminal), and `npm run build` pass (Node 22)

## Test plan

- [ ]
