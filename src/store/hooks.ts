import { createContext, useContext } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import type { Book } from '../domain/book'
import type { AppDispatch, RootState } from './index'

export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
export const useAppSelector = useSelector.withTypes<RootState>()

/** The opening book is static reference data, so it is provided outside the store. */
export const BookContext = createContext<Book | null>(null)

export function useBook(): Book {
  const book = useContext(BookContext)
  if (!book) throw new Error('useBook needs a BookContext provider')
  return book
}
