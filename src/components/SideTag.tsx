import type { Color } from '../domain/chess'

const NAME = { w: 'White', b: 'Black' } as const

/** Which side an opening is meant for. */
export function SideTag({ side }: { side: Color }) {
  return (
    <span className={`side-tag side-tag--${side}`} title={`Named for a ${NAME[side]} move, so usually played as ${NAME[side]}`}>
      {NAME[side]}
    </span>
  )
}
