export interface clutterSkin {
	materials: string[]
}

export interface clutterEntry {
	className: string
	modelFile: string
	skins: { [skinName: string]: clutterSkin }
}

export interface itemEntry {
	className: string
	modelFile: string
	modelType: string //"static" "character" "anim"; anim used for vfx, character unused in items.tbl
	flags: string[]
}

export interface entityEntry {
	className: string
	modelFile: string
	lodDistances?: number[] //does rf actually use this?
	flags: string[] //todo: use this? could be useful if security cameras are supposed to rotate
	defaultPrimary?: null   //TODO: show primary/secondary weapons ???
	defaultSecondary?: null //TODO: show primary/secondary weapons ???
	animStates?: null[] //todo: use this?
	animActions?: null[] //todo: use this?
	numSkins?: null //todo: use this?
	skins?: null //todo: use this?
	use?: null //todo: use this? "use" is the purpose of this entity type ("ai response" "command" "medic" "none" "turret" "vehicle")
}

export function parseClutter(clutterTxt: string): { [className: string]: clutterEntry } {
	let clutter: { [className: string] : clutterEntry } = {}
            
	//split non-empty lines and then iterate to build clutter list
	const clutterLines = clutterTxt.match(/[^\r\n]+/g)

	let currClassName = ''
	for (let clutterLine of clutterLines) {
		let trimmed = clutterLine.replace(/\/\/.*/, '').toLowerCase()
		if (trimmed.length > 0) {
			const findClassName = trimmed.match(/\$class name:\s+"(.+)"/i)
			if (findClassName) {
				currClassName = findClassName[1]
				clutter[currClassName] = <clutterEntry>{ className: currClassName }
			}

			const findModelFile = trimmed.match(/\$v3d filename:\s+"(.+)\.(v3d|v3m|v3c|vfx)"/i)
			if (findModelFile) {
				if (currClassName === '')
					throw `💩: currClassName === ''`
				clutter[currClassName].modelFile = findModelFile[1]
			}

			const findSkins = trimmed.match(/\$skin:\s+"(.+)"\s+\((.+)\)/i)
			if (findSkins) {
				if (currClassName === '')
					throw `💩: currClassName === ''`
				if (clutter[currClassName].skins === undefined)
					clutter[currClassName].skins = {}
				let skinTexs = findSkins[2].match(/("(?:.+?)\.(?:tga|vbm)")+/gi)
				clutter[currClassName].skins[findSkins[1]] = <clutterSkin>{ materials: []}
				for (let skinTex of skinTexs)
					clutter[currClassName].skins[findSkins[1]].materials.push(skinTex.match(/"(.+)\.(tga|vbm)"/i)[1])
			}
		}
	}

	return clutter
}

export function parseItems(itemTxt: string): { [className: string]: itemEntry } {
	let items: { [className: string] : itemEntry } = {}
            
	//split non-empty lines and then iterate to build clutter list
	const itemLines = itemTxt.match(/[^\r\n]+/g)

	let currClassName = ''
	for (let itemLine of itemLines) {
		let trimmed = itemLine.replace(/\/\/.*/, '').toLowerCase()
		if (trimmed.length > 0) {
			const findClassName = trimmed.match(/\$class name:\s+"(.+)"/i)
			if (findClassName) {
				currClassName = findClassName[1]
				items[currClassName] = <itemEntry>{ className: currClassName }
				items[currClassName].flags = []
			}

			const findModelFile = trimmed.match(/\$v3d filename:\s+"(.+)\.(v3d|v3m|v3c|vfx)"/i)
			if (findModelFile) {
				if (currClassName === '')
					throw `💩: currClassName === ''`
				items[currClassName].modelFile = findModelFile[1]
			}

			const findModelType = trimmed.match(/\$v3d type:\s+"(.+)"/i)
			if (findModelType) {
				if (currClassName === '')
					throw `💩: currClassName === ''`
				items[currClassName].modelType = findModelType[1]
			}

			const findFlags = trimmed.match(/\$flags:\s+\((.+)\)/i)
			if (findFlags) {
				if (currClassName === '')
					throw `💩: currClassName === ''`
				let flags = findFlags[1].match(/(?:"(.+?)")+/gi)
				for (let flag of flags)
					items[currClassName].flags.push(flag.replace(/"/g,''))
			}
		}
	}

	return items
}

export function parseEntities(entityTxt: string): { [className: string]: entityEntry } {
	let entities: { [className: string] : entityEntry } = {}

	//split non-empty lines and then iterate to build clutter list
	const itemLines = entityTxt.match(/[^\r\n]+/g)

	let currClassName = ''
	for (let itemLine of itemLines) {
		let trimmed = itemLine.replace(/\/\/.*/, '').toLowerCase()
		if (trimmed.length > 0) {
			const findClassName = trimmed.match(/\$name:\s+"(.+)"/i) //entities use "$name:" instead of "$class name:"
			if (findClassName) {
				currClassName = findClassName[1]
				entities[currClassName] = <entityEntry>{ className: currClassName }
				entities[currClassName].flags = []
			}

			const findModelFile = trimmed.match(/\$v3d filename:\s+"(.+)\.(v3d|v3m|v3c|vfx|vcm)"/i) //some entities refer to .vcm files
			if (findModelFile) {
				if (currClassName === '')
					throw `💩: currClassName === ''`
					entities[currClassName].modelFile = findModelFile[1]
			}

			const findFlags = trimmed.match(/\$flags:\s+\((.+)\)/i)
			if (findFlags) {
				if (currClassName === '')
					throw `💩: currClassName === ''`
				let flags = findFlags[1].match(/(?:"(.+?)")+/gi)
				for (let flag of flags)
					entities[currClassName].flags.push(flag.replace(/"/g,''))
			}

			const findFlags2 = trimmed.match(/\$flags2:\s+\((.+)\)/i)
			if (findFlags2) {
				if (currClassName === '')
					throw `💩: currClassName === ''`
				let flags = findFlags2[1].match(/(?:"(.+?)")+/gi)
				for (let flag of flags)
					entities[currClassName].flags.push(flag.replace(/"/g,''))
			}
		}
	}

	return entities
}
