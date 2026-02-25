/**
 * Ensure Orca hidden views don't keep occupying layout space.
 *
 * Orca marks inactive views with `.orca-hideable-hidden`, but some containers may still
 * keep `display: flex` inline and continue to affect layout. This manager watches class
 * changes and toggles `style.display` accordingly, while restoring original inline styles
 * when the view becomes active again.
 */

type HideableManager = {
  refCount: number
  observer: MutationObserver
  prevDisplayByEl: WeakMap<HTMLElement, string>
  modified: Set<HTMLElement>
}

const managerByPanel = new WeakMap<HTMLElement, HideableManager>()

const MANAGED_ATTR = "data-srs-hideable-display-managed"

function isHideable(el: unknown): el is HTMLElement {
  return el instanceof HTMLElement && el.classList.contains("orca-hideable")
}

function syncHideable(el: HTMLElement, manager: HideableManager) {
  const isHidden = el.classList.contains("orca-hideable-hidden")
  const isManaged = el.hasAttribute(MANAGED_ATTR)

  if (isHidden) {
    if (isManaged) {
      if (el.style.display !== "none") el.style.display = "none"
      return
    }
    if (el.style.display === "none") return

    manager.prevDisplayByEl.set(el, el.style.display)
    el.setAttribute(MANAGED_ATTR, "1")
    el.style.display = "none"
    manager.modified.add(el)
    return
  }

  if (!isManaged) return

  const prev = manager.prevDisplayByEl.get(el) ?? ""
  el.style.display = prev
  el.removeAttribute(MANAGED_ATTR)
  manager.modified.delete(el)
}

function syncAll(panelEl: HTMLElement, manager: HideableManager) {
  const hideables = Array.from(panelEl.querySelectorAll<HTMLElement>(".orca-hideable"))
  for (const el of hideables) syncHideable(el, manager)
}

function collectHideablesFromNode(node: Node): HTMLElement[] {
  if (!(node instanceof HTMLElement)) return []
  const out: HTMLElement[] = []
  if (node.classList.contains("orca-hideable")) out.push(node)
  out.push(...Array.from(node.querySelectorAll<HTMLElement>(".orca-hideable")))
  return out
}

function restoreAll(manager: HideableManager) {
  for (const el of manager.modified) {
    const prev = manager.prevDisplayByEl.get(el) ?? ""
    el.style.display = prev
    el.removeAttribute(MANAGED_ATTR)
  }
  manager.modified.clear()
}

/**
 * Attach a singleton manager to the nearest `.orca-panel`.
 * Returns a cleanup function that decrements refCount and restores when detached.
 */
export function attachHideableDisplayManager(rootEl: HTMLElement): () => void {
  const panelEl = rootEl.closest(".orca-panel") as HTMLElement | null
  if (!panelEl) return () => {}

  let manager = managerByPanel.get(panelEl)
  if (!manager) {
    const created: HideableManager = {
      refCount: 0,
      observer: new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === "attributes") {
            const target = mutation.target
            if (isHideable(target)) syncHideable(target, created)
            continue
          }

          if (mutation.type === "childList") {
            for (const added of mutation.addedNodes) {
              const hideables = collectHideablesFromNode(added)
              for (const el of hideables) syncHideable(el, created)
            }
          }
        }
      }),
      prevDisplayByEl: new WeakMap(),
      modified: new Set()
    }

    created.observer.observe(panelEl, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class"]
    })

    managerByPanel.set(panelEl, created)
    manager = created
  }

  manager.refCount += 1
  syncAll(panelEl, manager)

  return () => {
    const current = managerByPanel.get(panelEl)
    if (!current) return

    current.refCount -= 1
    if (current.refCount > 0) return

    current.observer.disconnect()
    restoreAll(current)
    managerByPanel.delete(panelEl)
  }
}

