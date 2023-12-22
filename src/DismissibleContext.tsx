import * as Yup from "yup"
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react"
import uniqBy from "lodash.uniqby"

type DismissibleKey = DismissibleContextProps["keys"][number]
type DismissibleKeys = DismissibleKey[]

interface DismissedKey {
  key: DismissibleKey
  timestamp: number
}

interface DismissedKeyStatus {
  status: boolean
  timestamp: number
}

interface DismissibleContextProps {
  dismissed: DismissedKey[]
  dismiss: (key: DismissibleKey | readonly DismissibleKey[]) => void
  isDismissed: (key: DismissibleKey) => DismissedKeyStatus
  keys: string[]
  syncFromLoggedOutUser: () => void
  /** An optional userID to track against  */
  userID?: string | null
}

const DismissibleContext = createContext<DismissibleContextProps>({
  dismissed: [],
  keys: [],
  isDismissed: () => ({ status: false, timestamp: 0 }),
} as unknown as DismissibleContextProps)

export const DismissibleProvider: React.FC<{
  children: React.ReactNode
  keys: DismissibleKeys
  userID?: DismissibleContextProps["userID"]
}> = ({ children, keys = [], userID }) => {
  const id = userID ?? DISMISSIBLE_LOGGED_OUT_USER_ID

  const [dismissed, setDismissed] = useState<DismissedKey[]>([])

  const localStorageUtils = useLocalStorageUtils({ keys })
  const { __dismiss__, get } = localStorageUtils

  const dismiss = useCallback(
    (key: DismissibleKey | DismissibleKey[]) => {
      const keys = Array.isArray(key) ? key : [key]
      const timestamp = Date.now()

      __dismiss__(id, timestamp, keys)

      setDismissed((prevDismissed) => {
        return uniqBy(
          [...prevDismissed, ...keys.map((k) => ({ key: k, timestamp }))],
          (d) => d.key
        )
      })
    },
    [id]
  )

  useEffect(() => {
    setDismissed(get(id))
  }, [id])

  const mounted = useDidMount()

  const isDismissed = useCallback(
    (key: DismissibleKey) => {
      if (!mounted) {
        return {
          status: false,
          timestamp: 0,
        }
      }

      const dismissedKey = dismissed.find((d) => d.key === key)

      return dismissedKey
        ? { status: true, timestamp: dismissedKey.timestamp }
        : { status: false, timestamp: 0 }
    },
    [dismissed, mounted]
  )

  /**
   * If the user is logged out, and performs some action which causes them
   * to login, we need to sync up the dismissed state from the logged out user
   */
  const syncFromLoggedOutUser = useCallback(() => {
    if (id === DISMISSIBLE_LOGGED_OUT_USER_ID) {
      return
    }

    const loggedOutDismissals = get(DISMISSIBLE_LOGGED_OUT_USER_ID)
    const loggedInDismissals = get(id)

    const dismissals = uniqBy(
      [...loggedOutDismissals, ...loggedInDismissals],
      (d) => d.key
    )

    setDismissed(dismissals)

    localStorage.setItem(localStorageKey(id), JSON.stringify(dismissals))
    localStorage.removeItem(localStorageKey(DISMISSIBLE_LOGGED_OUT_USER_ID))
  }, [id])

  // Ensure that the dismissed state stays in sync incase the user
  // has multiple tabs open.
  useEffect(() => {
    const current = get(id)

    if (current.length === 0) return

    const handleFocus = () => {
      setDismissed(current)
    }

    window.addEventListener("focus", handleFocus)

    return () => {
      window.removeEventListener("focus", handleFocus)
    }
  }, [id])

  return (
    <DismissibleContext.Provider
      value={{
        dismissed,
        dismiss,
        isDismissed,
        keys,
        syncFromLoggedOutUser,
      }}
    >
      {children}
    </DismissibleContext.Provider>
  )
}

export const useDismissibleContext = () => {
  return useContext(DismissibleContext)
}

export const DISMISSIBLE_LOGGED_OUT_USER_ID = "user" as const

export const localStorageKey = (id: string) => {
  return `progressive-onboarding.dismissed.${id}`
}

interface UseLocalStorageUtilsProps {
  keys: DismissibleContextProps["keys"]
}

export const useLocalStorageUtils = ({ keys }: UseLocalStorageUtilsProps) => {
  const schema = Yup.object().shape({
    key: Yup.string().oneOf([...keys]),
    timestamp: Yup.number(),
  })

  const isValid = (value: DismissedKey): value is DismissedKey => {
    return schema.isValidSync(value)
  }

  const parse = (value: string | null): DismissedKey[] => {
    if (!value) return []

    try {
      const parsed = JSON.parse(value)

      return parsed.filter((obj: DismissedKey) => {
        return isValid(obj) && keys.includes(obj.key)
      })
    } catch (err) {
      return []
    }
  }

  const __dismiss__ = (
    id: string,
    timestamp: number,
    key: DismissibleKey | DismissibleKey[]
  ) => {
    const keys = Array.isArray(key) ? key : [key]

    keys.forEach((key) => {
      const item = localStorage.getItem(localStorageKey(id))
      const dismissed = parse(item)

      localStorage.setItem(
        localStorageKey(id),
        JSON.stringify(
          uniqBy([...dismissed, { key, timestamp }], ({ key }) => key)
        )
      )
    })
  }

  const get = (id: string) => {
    const item = localStorage.getItem(localStorageKey(id))
    return parse(item)
  }

  const reset = (id: string) => {
    localStorage.removeItem(localStorageKey(id))
  }

  return {
    __dismiss__,
    get,
    isValid,
    parse,
    reset,
    schema,
  }
}

function useDidMount(defaultMounted = false) {
  const [isMounted, toggleMounted] = useState(defaultMounted)

  useEffect(() => {
    toggleMounted(true)
  }, [])

  return isMounted
}
