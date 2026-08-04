import { useState } from "react"

export function usePagination(initialPage = 1, initialLimit = 50) {
  const [page, setPage] = useState(initialPage)
  const [limit, setLimit] = useState(initialLimit)

  return { page, setPage, limit, setLimit }
}
