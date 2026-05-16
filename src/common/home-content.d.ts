export interface HomeContentCard {
  key?: string
  title: string
  image: string
}

export interface HomeContentSection {
  key: string
  title: string
  cards: HomeContentCard[]
}

export interface HomeMenuItem {
  key: string
  label: string
}

export interface HomeMenuGroup {
  key: string
  label: string
  children: HomeMenuItem[]
}

export const homeMenuTree: HomeMenuGroup[]
export const homeContentSections: HomeContentSection[]
