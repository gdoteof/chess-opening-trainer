/** An opening's ECO code, explained on hover for anyone who hasn't met the classification. */
export function Eco({ code }: { code: string }) {
  return (
    <abbr className="eco-code" title="Encyclopaedia of Chess Openings code: a standard index of openings, from A00 to E99">
      ECO {code}
    </abbr>
  )
}
