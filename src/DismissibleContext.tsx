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
  /** Add a new key to the dismissible context */
  addKey: (key: DismissibleKey) => void
}

const DismissibleContext = createContext<DismissibleContextProps>({
  dismissed: [],
  keys: [],
  isDismissed: () => ({ status: false, timestamp: 0 }),
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  addKey: () => {},
} as unknown as DismissibleContextProps)

export const DismissibleProvider: React.FC<{
  children: React.ReactNode
  keys: DismissibleKeys
  userID?: DismissibleContextProps["userID"]
}> = ({ children, keys: initialKeys = [], userID }) => {
  const id = userID ?? DISMISSIBLE_LOGGED_OUT_USER_ID

  const [keys, setKeys] = useState<DismissibleKeys>(initialKeys)
  const [dismissed, setDismissed] = useState<DismissedKey[]>([])

  // Make sure localStorageUtils always has the latest keys
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

  const addKey = useCallback((key: DismissibleKey) => {
    setKeys((prevKeys) => {
      // Only add the key if it doesn't already exist
      if (!prevKeys.includes(key)) {
        return [...prevKeys, key]
      }
      return prevKeys
    })
  }, [])

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
        addKey,
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
  // Create an updated schema every time this hook is called
  const getSchema = () => {
    return Yup.object().shape({
      key: Yup.string()
        .required()
        .oneOf([...keys]),
      timestamp: Yup.number().required(),
    })
  }

  const isValid = (value: any): value is DismissedKey => {
    // Use the current schema with the updated keys
    try {
      return getSchema().isValidSync(value)
    } catch (err) {
      return false
    }
  }

  const parse = (value: string | null): DismissedKey[] => {
    if (!value) return []

    try {
      const parsed = JSON.parse(value)

      return parsed.filter((obj: DismissedKey) => {
        // Only return keys that are in the current keys array
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
    const keysToAdd = Array.isArray(key) ? key : [key]

    keysToAdd.forEach((key) => {
      const item = localStorage.getItem(localStorageKey(id))
      const dismissed = parse(item)

      // Only save to localStorage if this key is in our known keys
      if (keys.includes(key)) {
        localStorage.setItem(
          localStorageKey(id),
          JSON.stringify(
            uniqBy([...dismissed, { key, timestamp }], ({ key }) => key)
          )
        )
      }
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
    schema: getSchema(),
  }
}

function useDidMount(defaultMounted = false) {
  const [isMounted, toggleMounted] = useState(defaultMounted)

  useEffect(() => {
    toggleMounted(true)
  }, [])

  return isMounted
}
