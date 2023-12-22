import React from "react"
import { renderHook } from "@testing-library/react-hooks"
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

  const { get, reset, parse, __dismiss__ } = useLocalStorageUtils({
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

      result.current.dismiss("follow-artist")

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

      result.current.dismiss(["follow-find", "follow-highlight"])

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

      result.current.syncFromLoggedOutUser()

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

        result.current.syncFromLoggedOutUser()

        expect(get(id)).toEqual(loggedOutDismissals)
      })
    })
  })
})
