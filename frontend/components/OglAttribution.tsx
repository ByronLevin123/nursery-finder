export default function OglAttribution() {
  return (
    <p className="text-xs text-gray-500 mt-4 border-t border-gray-200 pt-4">
      Inspection data sourced from the{' '}
      <a
        href="https://www.gov.uk/government/statistical-data-sets/monthly-management-information-ofsteds-early-years-register"
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-gray-700"
      >
        Ofsted Early Years Register
      </a>
      , licensed under the{' '}
      <a
        href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/"
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-gray-700"
      >
        Open Government Licence v3.0
      </a>
      . NurseryFinder is independent of Ofsted and the UK Government.
    </p>
  )
}
