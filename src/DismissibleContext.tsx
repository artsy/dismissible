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

  const [keys, setKeys] = useState<DismissibleKeys>(() => {
    const storedKeys = loadKeysFromStorage(initialKeys)

    return [
      ...initialKeys,
      ...storedKeys, // Keys were added from elsewhere, via addKey
    ]
  })

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

      setKeys((prevKeys) => {
        return prevKeys.filter((prevKey) => prevKey !== key)
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

  const addKey = useCallback(
    (key: DismissibleKey) => {
      setKeys((prevKeys) => {
        // Only add the key if it doesn't already exist
        if (!prevKeys.includes(key)) {
          // Store the key in localStorage so it persists between page loads
          if (localStorageUtils.get(key)) {
            localStorageUtils.reset(key)
          }

          localStorageUtils.set(key)
          return [...prevKeys, key]
        }
        return prevKeys
      })
    },
    [localStorageUtils]
  )

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
export const PREFIX = `progressive-onboarding.dismissed`

export const localStorageKey = (id: string) => {
  return `${PREFIX}.${id}`
}

const loadKeysFromStorage = (initialKeys: DismissibleKeys): DismissibleKeys => {
  const allStorageKeys = Array.from(
    { length: localStorage.length },
    (_, index) => localStorage.key(index)
  ).filter(Boolean) as string[]

  const dynamicKeys = allStorageKeys.reduce<string[]>((acc, storageKey) => {
    if (!storageKey.startsWith(PREFIX)) {
      return acc
    }

    const key = localStorage.getItem(storageKey)

    if (!key) {
      return acc
    }
    if (initialKeys.includes(key)) {
      return acc
    }

    let isDismissed = false
    try {
      isDismissed = JSON.parse(key)[0].timestamp
    } catch (error) {
      //
    }

    if (!isDismissed) {
      acc.push(key)
    }

    return acc
  }, [])

  return dynamicKeys
}

interface UseLocalStorageUtilsProps {
  keys: DismissibleContextProps["keys"]
}

export const useLocalStorageUtils = ({ keys }: UseLocalStorageUtilsProps) => {
  const getSchema = () => {
    return Yup.object().shape({
      key: Yup.string()
        .required()
        .oneOf([...keys]),
      timestamp: Yup.number().required(),
    })
  }

  const isValid = (value: any): value is DismissedKey => {
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

      reset(key)

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

  const set = (id: string) => {
    localStorage.setItem(localStorageKey(id), id)
  }

  const reset = (id: string) => {
    localStorage.removeItem(localStorageKey(id))
  }

  return {
    __dismiss__,
    get,
    set,
    isValid,
    parse,
    reset,
    schema: getSchema(),
    loadStoredKeys: () => loadKeysFromStorage(keys),
  }
}

function useDidMount(defaultMounted = false) {
  const [isMounted, toggleMounted] = useState(defaultMounted)

  useEffect(() => {
    toggleMounted(true)
  }, [])

  return isMounted
}
