import React from "react"
import { renderHook, act } from "@testing-library/react-hooks"
import {
  DISMISSIBLE_LOGGED_OUT_USER_ID,
  DismissibleProvider,
  useLocalStorageUtils,
  useDismissibleContext,
  localStorageKey,
} from "../DismissibleContext"

describe("DismissibleContext", () => {
  const keys = ["follow-artist", "follow-find", "follow-highlight"]
  const id = "example-id"

  beforeEach(() => {
    jest.useFakeTimers()
    localStorage.clear()
  })

  afterEach(() => {
    jest.useRealTimers()
    localStorage.clear()
  })

  const { get, set, reset, parse, __dismiss__ } = useLocalStorageUtils({
    keys,
  })

  describe("get", () => {
    afterEach(() => reset(id))

    it("returns an empty array if there is no value in local storage", () => {
      expect(get(id)).toEqual([])
    })

    it("returns empty array for the old format", () => {
      localStorage.setItem(
        localStorageKey(id),
        JSON.stringify(["follow-artist"])
      )
      expect(get(id)).toEqual([])

      localStorage.setItem(
        localStorageKey(id),
        JSON.stringify(["follow-artist", "follow-find"])
      )
      expect(get(id)).toEqual([])
    })

    it("returns the all dismissed keys if there is a value in local storage", () => {
      __dismiss__(id, 999, "follow-artist")
      expect(get(id)).toEqual([{ key: "follow-artist", timestamp: 999 }])
      __dismiss__(id, 444, "follow-find")
      expect(get(id)).toEqual([
        { key: "follow-artist", timestamp: 999 },
        { key: "follow-find", timestamp: 444 },
      ])
    })

    it("does not return duplicate keys", () => {
      __dismiss__(id, 555, "follow-artist")
      expect(get(id)).toEqual([{ key: "follow-artist", timestamp: 555 }])
      __dismiss__(id, 555, "follow-artist")
      expect(get(id)).toEqual([{ key: "follow-artist", timestamp: 555 }])
    })
  })

  describe("parse", () => {
    it("returns an empty array if the value is null", () => {
      expect(parse(null)).toEqual([])
    })

    it("returns an empty array if the value is not an array", () => {
      expect(parse("foo")).toEqual([])
    })

    it("returns an empty array if the value is an array of non-strings", () => {
      expect(parse(JSON.stringify([1, 2, 3]))).toEqual([])
    })

    it("returns an empty array if the value is an array of strings that are not valid keys", () => {
      expect(parse(JSON.stringify(["foo", "bar", "baz"]))).toEqual([])
    })

    it("returns an array of valid keys if the value is an array of strings that are valid keys", () => {
      expect(
        parse(
          JSON.stringify([
            { key: "follow-artist", timestamp: 555 },
            { key: "follow-find", timestamp: 555 },
            { key: "follow-highlight", timestamp: 555 },
          ])
        )
      ).toEqual([
        { key: "follow-artist", timestamp: 555 },
        { key: "follow-find", timestamp: 555 },
        { key: "follow-highlight", timestamp: 555 },
      ])
    })

    it("returns only the valid keys", () => {
      expect(
        parse(
          JSON.stringify([
            { key: "follow-artist", timestamp: 555 },
            { key: "follow-find", timestamp: 555 },
            { key: "follow-highlight", timestamp: 555 },
            "foo",
            { key: "no", timestamp: 555 },
            { key: "alert-create", timestamp: "wrong" },
            "baz",
            1,
            2,
            true,
            false,
            null,
            undefined,
          ])
        )
      ).toEqual([
        { key: "follow-artist", timestamp: 555 },
        { key: "follow-find", timestamp: 555 },
        { key: "follow-highlight", timestamp: 555 },
      ])
    })
  })

  describe("__dismiss__", () => {
    afterEach(() => reset(id))

    it("adds the key to local storage", () => {
      __dismiss__(id, 555, "follow-artist")
      expect(get(id)).toEqual([{ key: "follow-artist", timestamp: 555 }])
    })

    it("adds multiple keys to local storage", () => {
      __dismiss__(id, 555, ["follow-artist", "follow-find"])
      expect(get(id)).toEqual([
        { key: "follow-artist", timestamp: 555 },
        { key: "follow-find", timestamp: 555 },
      ])
    })

    it("does not add duplicate keys to local storage", () => {
      __dismiss__(id, 555, "follow-artist")
      expect(get(id)).toEqual([{ key: "follow-artist", timestamp: 555 }])
      __dismiss__(id, 555, "follow-artist")
      expect(get(id)).toEqual([{ key: "follow-artist", timestamp: 555 }])
    })

    it('handles subsequent calls to "dismiss"', () => {
      __dismiss__(id, 555, "follow-artist")
      expect(get(id)).toEqual([{ key: "follow-artist", timestamp: 555 }])
      __dismiss__(id, 555, "follow-find")
      expect(get(id)).toEqual([
        { key: "follow-artist", timestamp: 555 },
        { key: "follow-find", timestamp: 555 },
      ])
      __dismiss__(id, 555, "follow-highlight")
      expect(get(id)).toEqual([
        { key: "follow-artist", timestamp: 555 },
        { key: "follow-find", timestamp: 555 },
        { key: "follow-highlight", timestamp: 555 },
      ])
    })
  })

  describe("set", () => {
    afterEach(() => reset(id))

    it("sets the value in local storage", () => {
      act(() => {
        set(id)
      })
      expect(localStorage.getItem(localStorageKey(id))).toEqual(id)
    })

    it("persists the value to localStorage with the given key", () => {
      const testKey = "test-key"
      act(() => {
        set(testKey)
      })
      expect(localStorage.getItem(localStorageKey(testKey))).toBe(testKey)
    })
  })

  describe("dismiss", () => {
    afterEach(() => reset(id))

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <DismissibleProvider keys={keys} userID={id}>
        {children}
      </DismissibleProvider>
    )

    it("dismisses keys", () => {
      const { result } = renderHook(useDismissibleContext, {
        wrapper,
      })

      act(() => {
        result.current.dismiss("follow-artist")
      })

      expect(result.current.isDismissed("follow-artist")).toEqual({
        status: true,
        timestamp: expect.any(Number),
      })

      expect(result.current.isDismissed("follow-find")).toEqual({
        status: false,
        timestamp: 0,
      })

      expect(result.current.isDismissed("follow-highlight")).toEqual({
        status: false,
        timestamp: 0,
      })

      expect(get(id)).toEqual([
        { key: "follow-artist", timestamp: expect.any(Number) },
      ])

      act(() => {
        result.current.dismiss(["follow-find", "follow-highlight"])
      })

      expect(result.current.isDismissed("follow-artist")).toEqual({
        status: true,
        timestamp: expect.any(Number),
      })
      expect(result.current.isDismissed("follow-find")).toEqual({
        status: true,
        timestamp: expect.any(Number),
      })
      expect(result.current.isDismissed("follow-highlight")).toEqual({
        status: true,
        timestamp: expect.any(Number),
      })

      expect(get(id)).toEqual([
        { key: "follow-artist", timestamp: expect.any(Number) },
        { key: "follow-find", timestamp: expect.any(Number) },
        { key: "follow-highlight", timestamp: expect.any(Number) },
      ])
    })
  })

  describe("syncFromLoggedOutUser", () => {
    it("does nothing if the user is logged out", () => {
      const { result } = renderHook(useDismissibleContext, {
        wrapper: ({ children }: { children: React.ReactNode }) => (
          <DismissibleProvider keys={keys} userID={id}>
            {children}
          </DismissibleProvider>
        ),
      })

      act(() => {
        result.current.syncFromLoggedOutUser()
      })

      expect(get(id)).toEqual([])
    })

    describe("logged in", () => {
      it("syncs the dismissed state from the logged out user", () => {
        const loggedOutUserId = DISMISSIBLE_LOGGED_OUT_USER_ID

        const loggedOutDismissals = [
          { key: "follow-artist", timestamp: 555 },
          { key: "follow-find", timestamp: 555 },
        ]

        localStorage.setItem(
          localStorageKey(loggedOutUserId),
          JSON.stringify(loggedOutDismissals)
        )

        expect(get(id)).toEqual([])

        const { result } = renderHook(useDismissibleContext, {
          wrapper: ({ children }: { children: React.ReactNode }) => (
            <DismissibleProvider keys={keys} userID={id}>
              {children}
            </DismissibleProvider>
          ),
        })

        act(() => {
          result.current.syncFromLoggedOutUser()
        })

        expect(get(id)).toEqual(loggedOutDismissals)
      })
    })
  })

  describe("addKey", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <DismissibleProvider keys={keys} userID={id}>
        {children}
      </DismissibleProvider>
    )

    it("adds a new key to the keys array", () => {
      const { result } = renderHook(useDismissibleContext, {
        wrapper,
      })

      expect(result.current.keys).toEqual(keys)

      const newKey = "alert-visible-after-action"
      act(() => {
        result.current.addKey(newKey)
      })

      expect(result.current.keys).toContain(newKey)
      expect(result.current.keys.length).toBe(keys.length + 1)
      expect(localStorage.getItem(localStorageKey(newKey))).toBe(newKey)
    })

    it("doesn't add duplicate keys", () => {
      const { result } = renderHook(useDismissibleContext, {
        wrapper,
      })

      const existingKey = keys[0]
      act(() => {
        result.current.addKey(existingKey)
      })

      expect(result.current.keys.length).toBe(keys.length)

      const newKey = "new-feature-alert"
      act(() => {
        result.current.addKey(newKey)
      })

      expect(result.current.keys).toContain(newKey)

      act(() => {
        result.current.addKey(newKey)
      })

      expect(result.current.keys.length).toBe(keys.length + 1)
    })

    it("allows dismissing a dynamically added key", () => {
      const { result } = renderHook(useDismissibleContext, {
        wrapper,
      })

      const newKey = "runtime-added-alert"
      act(() => {
        result.current.addKey(newKey)
      })

      expect(result.current.isDismissed(newKey)).toEqual({
        status: false,
        timestamp: 0,
      })

      expect(result.current.keys).toContain(newKey)

      act(() => {
        result.current.dismiss(newKey)
      })

      expect(result.current.isDismissed(newKey)).toEqual({
        status: true,
        timestamp: expect.any(Number),
      })

      expect(
        result.current.dismissed.find((d) => d.key === newKey)
      ).toBeTruthy()
    })

    it("loads previously added keys from localStorage on mount", () => {
      const storedKey = "previously-added-key"
      localStorage.setItem(localStorageKey(storedKey), storedKey)

      const { result } = renderHook(useDismissibleContext, {
        wrapper,
      })

      expect(result.current.keys).toContain(storedKey)

      act(() => {
        result.current.dismiss(storedKey)
      })

      expect(result.current.isDismissed(storedKey)).toEqual({
        status: true,
        timestamp: expect.any(Number),
      })
    })
  })
})
