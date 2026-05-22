export const WAR2_ASSET_PATH = '/assets/greyveil/war2'

export const WAR2_ASSETS = {
  terrain: {
    grass: 'war2-terrain-grass',
    water: 'war2-terrain-water',
    mountain: 'war2-terrain-mountain',
  },
  resources: {
    tree: 'war2-tree-pine',
  },
  buildings: {
    townhall: 'war2-building-townhall',
    barracks: 'war2-building-barracks',
    farm: 'war2-building-farm',
    mine: 'war2-building-mine',
    watchtower: 'war2-building-watchtower',
  },
  units: {
    worker: 'war2-unit-worker',
    soldier: 'war2-unit-soldier',
    swordsman: 'war2-unit-swordsman',
    archer: 'war2-unit-archer',
  },
} as const

export const WAR2_ASSET_FILES: { key: string; path: string }[] = [
  { key: WAR2_ASSETS.terrain.grass, path: `${WAR2_ASSET_PATH}/terrain-grass.png` },
  { key: WAR2_ASSETS.terrain.water, path: `${WAR2_ASSET_PATH}/terrain-water.png` },
  { key: WAR2_ASSETS.terrain.mountain, path: `${WAR2_ASSET_PATH}/terrain-mountain.png` },
  { key: WAR2_ASSETS.resources.tree, path: `${WAR2_ASSET_PATH}/tree-pine.png` },
  { key: WAR2_ASSETS.buildings.townhall, path: `${WAR2_ASSET_PATH}/townhall.png` },
  { key: WAR2_ASSETS.buildings.barracks, path: `${WAR2_ASSET_PATH}/barracks.png` },
  { key: WAR2_ASSETS.buildings.farm, path: `${WAR2_ASSET_PATH}/farm.png` },
  { key: WAR2_ASSETS.buildings.mine, path: `${WAR2_ASSET_PATH}/mine.png` },
  { key: WAR2_ASSETS.buildings.watchtower, path: `${WAR2_ASSET_PATH}/watchtower.png` },
  { key: WAR2_ASSETS.units.worker, path: `${WAR2_ASSET_PATH}/worker.png` },
  { key: WAR2_ASSETS.units.soldier, path: `${WAR2_ASSET_PATH}/soldier.png` },
  { key: WAR2_ASSETS.units.swordsman, path: `${WAR2_ASSET_PATH}/swordsman.png` },
  { key: WAR2_ASSETS.units.archer, path: `${WAR2_ASSET_PATH}/archer.png` },
]
