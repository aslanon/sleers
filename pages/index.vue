<template>
	<!-- Üst Kontrol Çubuğu -->
	<div
		class="w-full sticky top-0 z-50 flex items-center space-x-4 rounded-xl bg-[#1a1b26]/90 backdrop-blur-3xl px-4 py-2 text-white border border-gray-700"
		:class="{ 'cursor-grab': !isDragging, 'cursor-grabbing': isDragging }"
		@mousedown="startDrag"
	>
		<button
			@click="closeWindow"
			class="bg-white text-black rounded-full p-[4px] hover:bg-white/80 cursor-pointer"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-4 w-4"
				viewBox="0 0 20 20"
				fill="currentColor"
			>
				<path
					fill-rule="evenodd"
					d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
					clip-rule="evenodd"
				/>
			</svg>
		</button>
		<div style="width: 0.51px" class="h-10 bg-white/10 rounded-full"></div>

		<!-- Kayıt Kontrolleri -->
		<div class="flex items-center space-x-4 flex-wrap">
			<!-- Recording Type Selection -->
			<div class="flex items-center space-x-2">
				<!-- Screen Recording Button -->
				<!-- <button
					@click="selectRecordingType('screen')"
					class="p-2 hover:bg-white/10 rounded-lg"
					title="Screen Recording"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-5 w-5"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
						/>
					</svg>
				</button> -->

				<!-- Window Recording Button -->
				<!-- <button
					@click="selectRecordingType('window')"
					class="p-2 hover:bg-white/10 rounded-lg"
					title="Window Recording"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-5 w-5"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
						/>
					</svg>
				</button> -->
				<!-- Dynamic Screen Overlay Button -->
				<button
					@click="startDynamicScreenOverlay"
					class="p-2 flex items-center flex-col gap-2 hover:bg-white/10 rounded-lg"
					title="Ekran Seç ve Kayıt Başlat (Screen Selection)"
				>
					<svg
						width="27"
						height="21"
						viewBox="0 0 27 21"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							d="M20 15C20.5523 15 21 15.4477 21 16V17C21 17.5523 20.5523 18 20 18H7C6.44772 18 6 17.5523 6 17V16C6 15.4477 6.44772 15 7 15H20Z"
							fill="white"
						/>
						<path
							fill-rule="evenodd"
							clip-rule="evenodd"
							d="M23 0C25.2091 0 27 1.79086 27 4V17C27 19.14 25.3194 20.8879 23.2061 20.9951L23 21H4L3.79395 20.9951C1.7488 20.8913 0.108652 19.2512 0.00488281 17.2061L0 17V4C0 1.79086 1.79086 1.61064e-08 4 0H23ZM1 17C1 18.6569 2.34315 20 4 20H23C24.6569 20 26 18.6569 26 17V4H1V17ZM4 1C2.6938 1 1.58275 1.83484 1.1709 3H25.8262C25.4141 1.83532 24.3059 1 23 1H4Z"
							fill="white"
						/>
					</svg>
					<span class="text-xs">Display</span>
				</button>
				<!-- Dynamic Window Overlay Button -->
				<button
					@click="startDynamicOverlay"
					class="p-2 flex items-center flex-col gap-2 hover:bg-white/10 rounded-lg"
					title="Pencere Seç ve Kayıt Başlat (Screen Studio style)"
				>
					<svg
						width="27"
						height="21"
						viewBox="0 0 27 21"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							d="M23 0C25.2091 0 27 1.79086 27 4V17C27 19.14 25.3194 20.8879 23.2061 20.9951L23 21H4L3.79395 20.9951C1.7488 20.8913 0.108652 19.2512 0.00488281 17.2061L0 17V4C0 1.79086 1.79086 1.61064e-08 4 0H23ZM1 17C1 18.6569 2.34315 20 4 20H23C24.6569 20 26 18.6569 26 17V4H1V17ZM4 1C3.44772 1 3 1.44772 3 2C3 2.55228 3.44772 3 4 3C4.55228 3 5 2.55228 5 2C5 1.44772 4.55228 1 4 1ZM7 1C6.44772 1 6 1.44772 6 2C6 2.55228 6.44772 3 7 3C7.55228 3 8 2.55228 8 2C8 1.44772 7.55228 1 7 1ZM10 1C9.44772 1 9 1.44772 9 2C9 2.55228 9.44772 3 10 3C10.5523 3 11 2.55228 11 2C11 1.44772 10.5523 1 10 1Z"
							fill="#D9D9D9"
						/>
					</svg>
					<span class="text-xs">Window</span>
				</button>

				<!-- Area Recording Button -->
				<button
					@click="selectRecordingType('area')"
					class="p-2 flex items-center flex-col gap-2 hover:bg-white/10 rounded-lg"
					title="Area Recording"
				>
					<svg
						width="29"
						height="23"
						viewBox="0 0 29 23"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							d="M3.41113 21.1191C3.88742 21.3623 4.42688 21.5 5 21.5H8.34961V22.5H5C4.26517 22.5 3.56988 22.3232 2.95605 22.0098L2.51074 21.7832L2.96582 20.8926L3.41113 21.1191ZM17.8496 21.5V22.5H11.1504V21.5H17.8496ZM26.4893 21.7832L26.0439 22.0098C25.4301 22.3232 24.7348 22.5 24 22.5H20.6504V21.5H24C24.5731 21.5 25.1126 21.3623 25.5889 21.1191L26.0342 20.8926L26.4893 21.7832ZM0.5 18V13.5996H1.5V18C1.5 18.5731 1.63769 19.1126 1.88086 19.5889L2.10742 20.0342L1.2168 20.4893L0.990234 20.0439C0.676849 19.4301 0.5 18.7348 0.5 18ZM27.5 18V13.5996H28.5V18C28.5 18.7348 28.3232 19.4301 28.0098 20.0439L27.7832 20.4893L26.8926 20.0342L27.1191 19.5889C27.3623 19.1126 27.5 18.5731 27.5 18ZM0.5 5C0.5 4.26517 0.676849 3.56988 0.990234 2.95605L1.2168 2.51074L2.10742 2.96582L1.88086 3.41113C1.63769 3.88742 1.5 4.42688 1.5 5V9.40039H0.5V5ZM27.5 5C27.5 4.42688 27.3623 3.88742 27.1191 3.41113L26.8926 2.96582L27.7832 2.51074L28.0098 2.95605C28.3232 3.56988 28.5 4.26517 28.5 5V9.40039H27.5V5ZM8.34961 0.5V1.5H5C4.42688 1.5 3.88742 1.63769 3.41113 1.88086L2.96582 2.10742L2.51074 1.2168L2.95605 0.990234C3.56988 0.676849 4.26517 0.5 5 0.5H8.34961ZM24 0.5C24.7348 0.5 25.4301 0.676849 26.0439 0.990234L26.4893 1.2168L26.0342 2.10742L25.5889 1.88086C25.1126 1.63769 24.5731 1.5 24 1.5H20.6504V0.5H24ZM17.8496 0.5V1.5H11.1504V0.5H17.8496Z"
							fill="white"
						/>
					</svg>
					<span class="text-xs">Area</span>
				</button>
			</div>
			<div style="width: 0.51px" class="h-10 bg-white/10 rounded-full"></div>

			<label
				:class="{
					'!opacity-50': selectedVideoDevice === 'none',
				}"
				for="video-select"
				@click.stop.prevent="openVideoSelect"
				class="flex cursor-pointer justify-center hover:!bg-white/10 w-[150px] h-[48px] max-h-[48px] !min-w-[150px] max-w-[150px] min-h-[48px] truncate gap-2 text-white rounded-lg px-2 py-1 items-center pl-2"
			>
				<span class="flex items-center justify-center">
					<svg
						v-if="selectedVideoDevice !== 'none'"
						width="22"
						height="16"
						viewBox="0 0 22 16"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							d="M14.5 6.25L19.2197 1.53033C19.6921 1.05786 20.5 1.39248 20.5 2.06066V13.4393C20.5 14.1075 19.6921 14.4421 19.2197 13.9697L14.5 9.25M3.25 14.5H12.25C13.4926 14.5 14.5 13.4926 14.5 12.25V3.25C14.5 2.00736 13.4926 1 12.25 1H3.25C2.00736 1 1 2.00736 1 3.25V12.25C1 13.4926 2.00736 14.5 3.25 14.5Z"
							stroke="white"
							stroke-width="1.5"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
					<svg
						v-else
						width="22"
						height="17"
						viewBox="0 0 22 17"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							d="M15.25 7L19.9697 2.28033C20.4421 1.80786 21.25 2.14248 21.25 2.81066V14.1893C21.25 14.8575 20.4421 15.1921 19.9697 14.7197L15.25 10M11.5 15.25H4C2.75736 15.25 1.75 14.2426 1.75 13V5.5M14.591 14.591L16 16M14.591 14.591C14.9982 14.1838 15.25 13.6213 15.25 13V4C15.25 2.75736 14.2426 1.75 13 1.75H4C3.37868 1.75 2.81618 2.00184 2.40901 2.40901M14.591 14.591L2.40901 2.40901M1 1L2.40901 2.40901"
							stroke="white"
							stroke-width="1.5"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
				</span>
				<select
					id="video-select"
					ref="videoSelectRef"
					v-model="selectedVideoDevice"
					class="bg-transparent ring-non truncate w-full outline-none appearance-none text-xs font-semibold"
				>
					<option value="none">Do not record camera</option>
					<option disabled>────────────────────</option>
					<option
						v-for="device in videoDevices"
						:key="device.deviceId"
						:value="device.deviceId"
					>
						{{ device.label || `Camera ${device.deviceId}` }}
					</option>
				</select>
			</label>
			<!-- Microphone unified block: icon + select + optional level bar -->
			<div
				:class="{
					'!opacity-50': selectedAudioDevice === 'none',
				}"
				@click.stop.prevent="openAudioSelect"
				class="flex flex-col justify-center items-center gap-1 p-2 rounded-lg hover:bg-white/10 w-[150px] h-[48px] max-h-[48px] !min-w-[150px] max-w-[150px] min-h-[48px] truncate"
			>
				<label
					for="select-audio"
					class="cursor-pointer flex flex-row items-center"
				>
					<span class="flex items-center justify-center" style="zoom: 0.7">
						<svg
							v-if="selectedAudioDevice !== 'none'"
							width="24"
							height="25"
							viewBox="0 0 24 25"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								d="M8.25 4.75C8.25 2.67893 9.92893 1 12 1C14.0711 1 15.75 2.67893 15.75 4.75V13C15.75 15.0711 14.0711 16.75 12 16.75C9.92893 16.75 8.25 15.0711 8.25 13V4.75Z"
								fill="white"
							/>
							<path
								d="M6 10.75C6.41421 10.75 6.75 11.0858 6.75 11.5V13C6.75 15.8995 9.1005 18.25 12 18.25C14.8995 18.25 17.25 15.8995 17.25 13V11.5C17.25 11.0858 17.5858 10.75 18 10.75C18.4142 10.75 18.75 11.0858 18.75 11.5V13C18.75 16.4744 16.125 19.3357 12.75 19.7088V22H15.75C16.1642 22 16.5 22.3358 16.5 22.75C16.5 23.1642 16.1642 23.5 15.75 23.5H8.25C7.83579 23.5 7.5 23.1642 7.5 22.75C7.5 22.3358 7.83579 22 8.25 22H11.25V19.7088C7.87504 19.3357 5.25 16.4744 5.25 13V11.5C5.25 11.0858 5.58579 10.75 6 10.75Z"
								fill="white"
							/>
						</svg>
						<svg
							v-else
							width="16"
							height="23"
							viewBox="0 0 16 23"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								d="M1.55183 9.75C1.96588 9.7502 2.30183 10.0859 2.30183 10.5V12C2.30183 14.8995 4.65233 17.25 7.55183 17.25C8.82435 17.2499 9.99078 16.7962 10.8995 16.043L11.963 17.1064C10.9576 17.9757 9.69409 18.555 8.30183 18.709V21H11.3018C11.7159 21.0002 12.0518 21.3359 12.0518 21.75C12.0518 22.1641 11.7159 22.4998 11.3018 22.5H3.80183C3.38762 22.5 3.05183 22.1642 3.05183 21.75C3.05183 21.3358 3.38762 21 3.80183 21H6.80183V18.709C3.42687 18.3359 0.801829 15.4744 0.801829 12V10.5C0.801829 10.0858 1.13762 9.75 1.55183 9.75ZM0.264719 2.96289C0.658413 2.56939 1.34801 2.62138 1.80573 3.0791L15.0567 16.3301C15.5144 16.7878 15.5664 17.4774 15.1729 17.8711C14.7793 18.2648 14.0887 18.2136 13.6309 17.7559L0.379954 4.50488C-0.0778285 4.0471 -0.128949 3.35656 0.264719 2.96289ZM9.8321 14.9756C9.2002 15.4606 8.40991 15.7499 7.55183 15.75C5.48076 15.75 3.80183 14.0711 3.80183 12V8.94531L9.8321 14.9756ZM13.5518 9.75C13.9659 9.7502 14.3018 10.0859 14.3018 10.5V12C14.3018 12.7668 14.1731 13.5035 13.9376 14.1904L12.711 12.9648C12.7691 12.652 12.8018 12.3297 12.8018 12V10.5C12.8018 10.0858 13.1376 9.75 13.5518 9.75ZM7.55183 0C9.62273 0.000196387 11.3018 1.67905 11.3018 3.75V11.5547L3.80183 4.05469V3.75C3.80183 1.67893 5.48076 0 7.55183 0Z"
								fill="white"
							/>
						</svg>
					</span>
					<select
						id="select-audio"
						ref="audioSelectRef"
						v-model="selectedAudioDevice"
						class="bg-transparent max-w-[120px] ring-none outline-none appearance-none hover:bg-white/10 text-white rounded-lg px-2 py-1 text-xs font-medium truncate"
					>
						<option value="none">Do not record microphone</option>
						<option disabled>────────────────────</option>
						<option
							v-for="device in audioDevices"
							:key="device.deviceId"
							:value="device.deviceId"
						>
							{{
								device.label.replace("Default - ", "") ||
								`Microphone ${device.deviceId}`
							}}
						</option>
					</select>
				</label>
				<div
					v-if="selectedAudioDevice !== 'none'"
					class="w-[120px] bg-white/10 h-[3px] rounded-full overflow-hidden"
				>
					<div
						class="h-full bg-white/50 transition-all duration-75"
						:style="{ width: `${microphoneEnabled ? microphoneLevel : 0}%` }"
					></div>
				</div>
			</div>

			<!-- Sistem Sesi -->
			<button
				class="flex flex-row opacity-50 h-[48px] items-center gap-2 p-2 text-white hover:bg-white/10 rounded-lg text-xs font-semibold"
				:class="{ '!opacity-100': systemAudioEnabled }"
				@click="toggleSystemAudio"
			>
				<span class="flex items-center justify-center">
					<svg
						width="21"
						height="18"
						viewBox="0 0 21 18"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							d="M19.125 0C20.1605 0 21 0.839466 21 1.875V13.125C21 14.1605 20.1605 15 19.125 15H12.75V16.5H16.5C16.9142 16.5 17.25 16.8358 17.25 17.25C17.25 17.6642 16.9142 18 16.5 18H4.5C4.08579 18 3.75 17.6642 3.75 17.25C3.75 16.8358 4.08579 16.5 4.5 16.5H8.25V15H1.875C0.839466 15 0 14.1605 0 13.125V1.875C0 0.839466 0.839466 0 1.875 0H19.125ZM9.75 16.5H11.25V15H9.75V16.5ZM1.875 1.5C1.66789 1.5 1.5 1.66789 1.5 1.875V13.125C1.5 13.3321 1.66789 13.5 1.875 13.5H19.125C19.3321 13.5 19.5 13.3321 19.5 13.125V1.875C19.5 1.66789 19.3321 1.5 19.125 1.5H1.875ZM12.459 5.97559L11.2314 6.24121V10.0127C11.2314 10.5327 10.8686 10.9819 10.3604 11.0918L9.3584 11.3086C8.68096 11.455 8.04111 10.9392 8.04102 10.2461C8.04102 9.73382 8.39868 9.29063 8.89941 9.18262L10.2051 8.90137C10.3744 8.86476 10.495 8.71519 10.4951 8.54199V4.47168C10.4951 4.29835 10.6167 4.14796 10.7861 4.11133L12.459 3.75V5.97559Z"
							fill="white"
						/>
					</svg>
				</span>
				<span class="text-xs font-medium">System Audio</span>
			</button>

			<!-- Cursor tracking butonu kaldırıldı - artık gerçek kayıt sistemiyle entegre -->

			<!-- Kayıt Toggle Butonu -->
			<!-- <button
				@click="onRecordButtonClick"
				class="flex items-center space-x-2 h-[36px] px-4 py-2 rounded-lg"
				:class="
					isRecording
						? 'bg-red-600 hover:bg-red-700'
						: 'bg-white/10 hover:bg-gray-600'
				"
			>
				<span class="w-2 h-2 rounded-full bg-white" v-if="isRecording"></span>
				<span>{{ isRecording ? "Stop" : "Record" }}</span>
			</button> -->
			<div style="width: 0.51px" class="h-10 bg-white/10 rounded-full"></div>

			<!-- Ayarlar Butonu -->
			<!-- Editör Modu Butonu -->
			<button
				@click="openEditorMode"
				class="p-2 flex flex-row items-center gap-2 hover:bg-white/10 rounded-lg text-xs font-medium truncate"
				title="Go to Editor Without Recording"
			>
				<svg
					width="18"
					height="20"
					viewBox="0 0 18 20"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						d="M12.6122 3.47948C15.4927 4.76656 17.5 7.65662 17.5 11.0155C17.5 15.5719 13.8063 19.2655 9.25 19.2655C4.69365 19.2655 1 15.5719 1 11.0155C1 8.80347 1.87058 6.79476 3.28781 5.31333C4.0543 6.38374 5.07048 7.26318 6.25121 7.86651C6.29632 5.09084 7.59797 2.62065 9.61211 1C10.3755 2.02375 11.3879 2.88408 12.6122 3.47948Z"
						stroke="white"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
					<path
						d="M9.25 16.2659C11.3211 16.2659 13 14.587 13 12.5159C13 10.6126 11.5821 9.04049 9.74489 8.79828C8.73657 9.70282 8.03619 10.9437 7.82031 12.3445C7.03769 12.1532 6.31529 11.8084 5.68682 11.3438C5.56559 11.7126 5.5 12.1066 5.5 12.5159C5.5 14.587 7.17893 16.2659 9.25 16.2659Z"
						stroke="white"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>

				<span class="!m-0 !p-0">Edit</span>
			</button>
			<div style="width: 0.51px" class="h-10 bg-white/10 rounded-full"></div>

			<button
				@click="openRecordingSettings"
				class="p-2 hover:bg-white/10 rounded-lg"
			>
				<svg
					width="20"
					height="20"
					viewBox="0 0 20 20"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						d="M2.5 9.86254C2.5 14.0047 5.85786 17.3625 10 17.3625C14.1421 17.3625 17.5 14.0047 17.5 9.86254M2.5 9.86254C2.5 5.7204 5.85786 2.36254 10 2.36254C14.1421 2.36254 17.5 5.7204 17.5 9.86254M2.5 9.86254L1 9.86254M17.5 9.86254L19 9.86254M17.5 9.86254L10 9.86254M1.54256 12.9407L2.9521 12.4277M17.0475 7.29739L18.457 6.78436M3.10547 15.6482L4.25454 14.6841M15.7452 5.04225L16.8943 4.07807M5.4999 17.6575L6.2499 16.3585M13.7499 3.36812L14.4999 2.06908M8.43707 18.7265L8.69755 17.2493M11.3023 2.47721L11.5627 1M11.5627 18.7266L11.3023 17.2494M8.69755 2.47725L8.43708 1.00004M14.4999 17.6574L13.7499 16.3583M5.49995 2.06893L10 9.86254M16.8944 15.6476L15.7454 14.6834M4.25469 5.04163L3.10562 4.07745M18.4573 12.9409L17.0477 12.4278M2.95235 7.29754L1.54281 6.78451M10 9.86254L6.25 16.3577"
						stroke="white"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			</button>
		</div>
	</div>
</template>

<script setup>
import {
	onMounted,
	ref,
	watch,
	onUnmounted,
	onBeforeUnmount,
	nextTick,
} from "vue";
import { useMediaDevices } from "~/composables/useMediaDevices";
import { usePlayerSettings } from "~/composables/usePlayerSettings";
import { useScreen } from "~/composables/modules/useScreen";

const electron = window.electron;
const IPC_EVENTS = electron?.ipcRenderer?.IPC_EVENTS || {};

// Refs for programmatic opening of selects when their labels are clicked
const videoSelectRef = ref(null);
const audioSelectRef = ref(null);

const openVideoSelect = async () => {
	await nextTick();
	const el = videoSelectRef.value;
	if (!el) return;
	try {
		el.focus();
		if (typeof el.showPicker === "function") {
			el.showPicker();
		} else {
			el.click();
		}
	} catch (_) {
		el.click();
	}
};

const openAudioSelect = async () => {
	await nextTick();
	const el = audioSelectRef.value;
	if (!el) return;
	try {
		el.focus();
		if (typeof el.showPicker === "function") {
			el.showPicker();
		} else {
			el.click();
		}
	} catch (_) {
		el.click();
	}
};

const {
	videoDevices,
	audioDevices,
	selectedVideoDevice,
	selectedAudioDevice,
	mediaStream,
	isRecording,
	systemAudioEnabled,
	microphoneEnabled,
	microphoneLevel,
	currentAudioStream,
	isAudioAnalyserActive,
	selectedDelay,
	getDevices,
	startRecording,
	stopRecording,
	initAudioAnalyser,
	cleanupAudioAnalyser,
	toggleMicrophone,
	toggleSystemAudio,
	throttle,
} = useMediaDevices();

// Player settings: camera visibility kontrolü
const { updateCameraSettings } = usePlayerSettings();

const closeWindow = () => {
	electron?.windowControls.close();
};

// Delay yönetimi için state
const delayOptions = [0, 1000, 3002, 5000, 10000]; // 1sn, 3sn, 5sn
const selectedSource = ref(null);
const followMouse = ref(true);

// Recording type management
const availableScreens = ref([]);
const availableWindows = ref([]);

// Cursor tracking state kaldırıldı - artık gerçek kayıt sistemiyle entegre

// Yeni Kayıt state'i kaldırıldı

watch(followMouse, (newValue) => {
	if (electron?.ipcRenderer) {
		electron.ipcRenderer.send("TOGGLE_CAMERA_FOLLOW", newValue);
	}
});

// Delay değişikliğini izle
watch(selectedDelay, (newValue) => {
	if (electron?.ipcRenderer) {
		electron.ipcRenderer.send(
			IPC_EVENTS.UPDATE_RECORDING_DELAY,
			parseInt(newValue)
		);
	}
});

// Kamera cihaz seçimi değişince player kamera görünürlüğünü senkronize et
watch(
	selectedVideoDevice,
	(newVal) => {
		// 'none' ise görünürlüğü kapat, aksi halde aç
		const isNone = newVal === "none";
		updateCameraSettings({
			visible: !isNone,
			followMouse: isNone ? false : undefined,
			mergeWithCursor: isNone ? false : undefined,
			shadow: isNone ? 0 : undefined,
			borderWidth: isNone ? 0 : undefined,
		});
	},
	{ immediate: true }
);

// Kayıt düğmesi işlevi
const onRecordButtonClick = async () => {
	try {
		if (isRecording.value) {
			await stopRecording();
		} else {
			// MediaState'den güncel kaynak bilgisini al

			let currentRecordingSource = null;
			try {
				const mediaState = await electron?.ipcRenderer?.invoke(
					"GET_MEDIA_STATE"
				);
				currentRecordingSource = mediaState?.recordingSource;
			} catch (error) {
				console.warn("🔧 [index.vue] MediaState alınamadı:", error);
			}

			// Kaynak seçimi kontrolü
			let recordingOptions = {};

			// MediaState'de kaynak varsa onu kullan
			if (currentRecordingSource && currentRecordingSource.sourceId) {
				recordingOptions = {
					startScreen: true,
					startCamera: selectedVideoDevice.value !== "none", // No camera if 'none' selected
					startAudio: true,
				};
			} else {
				console.warn(
					"🔧 [index.vue] ⚠️ MediaState'de kaynak yok, default display ayarlanıyor"
				);

				// Default kaynak ayarla
				await electron?.ipcRenderer?.invoke("UPDATE_RECORDING_SOURCE", {
					sourceType: "display",
					sourceId: "screen:0",
					sourceName: "Display 1",
					macRecorderId: 0,
				});

				// 200ms bekle ki MediaState güncellensin
				await new Promise((resolve) => setTimeout(resolve, 200));

				recordingOptions = {
					startScreen: true,
					startCamera: selectedVideoDevice.value !== "none", // No camera if 'none' selected
					startAudio: true,
				};
			}

			// Kayıt başlat
			await startRecording(recordingOptions);
		}
	} catch (error) {
		console.error("Kayıt işleminde hata:", error);
	}
};

// Editör modunu açma fonksiyonu
const openEditorMode = () => {
	if (electron?.ipcRenderer) {
		// Editör modunu aç
		electron.ipcRenderer.send(IPC_EVENTS.OPEN_EDITOR_MODE);
	}
};

// toggleCursorTracking fonksiyonu kaldırıldı - cursor capture artık gerçek kayıt sistemiyle entegre

// Yeni Kayıt fonksiyonu kaldırıldı - artık sadece "Kaydet" butonu var

// Recording type selection - now triggers native overlays
const selectRecordingType = async (type) => {
	try {
		if (electron?.ipcRenderer) {
			if (type === "screen") {
				// Trigger native screen selection overlay
				electron.ipcRenderer.send("SHOW_NATIVE_SCREEN_SELECTOR");
			} else if (type === "window") {
				// Trigger native window selection overlay
				electron.ipcRenderer.send("SHOW_NATIVE_WINDOW_SELECTOR");
			} else if (type === "area") {
				// Trigger native area selection overlay
				electron.ipcRenderer.send("SHOW_NATIVE_AREA_SELECTOR");
			}
		}
	} catch (error) {
		console.error("Error triggering native selector:", error);
	}
};

// Dynamic Window Overlay - Screen Studio style with WindowSelector
const startDynamicOverlay = () => {
	try {
		if (window.electronAPI?.startDynamicWindowOverlay) {
			console.log("Starting native WindowSelector overlay...");
			window.electronAPI.startDynamicWindowOverlay();
		} else {
			console.error("Dynamic window overlay API not available");
		}
	} catch (error) {
		console.error("Error starting dynamic window overlay:", error);
	}
};

// Dynamic Screen Overlay - Screen Studio style with WindowSelector for screens
const startDynamicScreenOverlay = () => {
	try {
		if (window.electronAPI?.startDynamicScreenOverlay) {
			console.log("Starting native Screen Selector overlay...");
			window.electronAPI.startDynamicScreenOverlay();
		} else {
			console.error("Dynamic screen overlay API not available");
		}
	} catch (error) {
		console.error("Error starting dynamic screen overlay:", error);
	}
};

// Test function to trigger screen recording manually
const testScreenRecording = () => {
	console.log("[TEST] Manually triggering screen recording...");

	// Simulate screen selection data
	const testScreenData = {
		screenInfo: {
			id: 1,
			name: "Display 1",
			x: 0,
			y: 0,
			width: 2048,
			height: 1330,
		},
		cropInfo: {
			x: 0,
			y: 0,
			width: 2048,
			height: 1330,
		},
		source: {
			sourceType: "screen",
			id: 1,
			name: "Display 1",
			thumbnail: "",
		},
	};

	// Test by sending message to main process, which will echo back
	console.log("[TEST] Testing screen recording via main process...");

	// Send test data to main process to simulate overlay selection
	if (window.electronAPI?.startDynamicScreenOverlay) {
		// For now, just trigger manual function call
		// Later we can add a test IPC event
		console.log("[TEST] Manual test - use real overlay for testing");
	}
};

// Add to global for testing
if (typeof window !== "undefined") {
	window.testScreenRecording = testScreenRecording;
}

// Handle window selection and start recording
onMounted(() => {
	console.log("[INIT] Mounting component, setting up IPC handlers...");
	if (window.electronAPI) {
		console.log("[INIT] ElectronAPI available, registering handlers");
		// Handle window selection and start recording immediately
		window.electronAPI.onStartWindowRecording(async (event, data) => {
			console.log("[DEBUG] START_WINDOW_RECORDING event received:", data);
			console.log("Starting window recording:", data.windowInfo);

			// Set selected source for UI display
			selectedSource.value = data.source;

			try {
				// Prepare recording options with crop info
				const recordingOptions = {
					startScreen: true,
					startCamera: selectedVideoDevice.value !== "none",
					startAudio: true,
					systemAudio: systemAudioEnabled.value,
					microphone: microphoneEnabled.value,
					microphoneDeviceId: selectedAudioDevice.value,
					// Window specific recording - pass window info for crop recording
					recordingSource: {
						type: "window",
						windowId: data.windowInfo.id,
						cropArea: data.cropInfo,
						windowInfo: data.windowInfo,
					},
				};

				console.log("[Vue] Starting recording with options:", recordingOptions);

				// Start recording using Sleer's recording system
				await startRecording(recordingOptions);

				console.log(
					`🎬 Kayıt başladı: ${data.windowInfo.title} (${data.windowInfo.appName})`
				);
			} catch (error) {
				console.error("Recording start failed:", error);
				console.log(`❌ Kayıt başlatılamadı: ${error.message}`);
			}
		});

		console.log("[INIT] START_WINDOW_RECORDING handler registered");

		// Handle screen selection and start recording immediately
		window.electronAPI.onStartScreenRecording(async (event, data) => {
			console.log("[DEBUG] START_SCREEN_RECORDING event received:", data);
			console.log("Starting screen recording:", data.screenInfo);

			// Set selected source for UI display
			selectedSource.value = data.source;

			try {
				// Prepare recording options with crop info (full screen)
				const recordingOptions = {
					startScreen: true,
					startCamera: selectedVideoDevice.value !== "none",
					startAudio: true,
					systemAudio: systemAudioEnabled.value,
					microphone: microphoneEnabled.value,
					microphoneDeviceId: selectedAudioDevice.value,
					// Screen specific recording - pass screen info for full screen recording
					recordingSource: {
						type: "screen",
						displayId: data.screenInfo.id,
						cropArea: data.cropInfo,
						screenInfo: data.screenInfo,
					},
				};

				console.log(
					"[Vue] Starting screen recording with options:",
					recordingOptions
				);

				// Start recording using Sleer's recording system
				await startRecording(recordingOptions);

				console.log(`🖥️ Ekran kaydı başladı: ${data.screenInfo.name}`);
			} catch (error) {
				console.error("Screen recording start failed:", error);
				console.log(`❌ Ekran kaydı başlatılamadı: ${error.message}`);
			}
		});

		console.log("[INIT] START_SCREEN_RECORDING handler registered");
		console.log("[INIT] All IPC handlers setup complete");
	} else {
		console.error("[INIT] ElectronAPI not available!");
	}
});

// Load available screens and windows
const loadAvailableSources = async () => {
	try {
		if (electron?.ipcRenderer) {
			const [screens, windows] = await Promise.all([
				electron.ipcRenderer.invoke("GET_MAC_SCREENS") || [],
				electron.ipcRenderer.invoke("GET_MAC_WINDOWS") || [],
			]);

			availableScreens.value = screens.map((screen, index) => ({
				id: screen.id ? `screen:${screen.id}` : `screen:${index}`,
				name:
					screen.name ||
					screen.displayName ||
					`Display ${screen.id || index + 1}`,
				type: "display",
				macRecorderId: screen.id || index,
			}));

			availableWindows.value = windows.map((window, index) => ({
				id: window.id ? `window:${window.id}` : `window:${index}`,
				name:
					window.name || window.title || window.windowName || "Unknown Window",
				type: "window",
				macRecorderId: window.id || index,
			}));
		}
	} catch (error) {
		console.error("Failed to load recording sources:", error);
	}
};

// Kaynak seçimi
const selectSource = (source) => {
	selectedSource.value = source;

	// Alan seçimi ise özel bir işlem yap
	if (source.type === "area") {
		if (electron?.ipcRenderer) {
			electron.ipcRenderer.send(
				electron.ipcRenderer.IPC_EVENTS.START_AREA_SELECTION
			);
		}
	}
};

// Throttled updateAudioSettings fonksiyonu
const throttledUpdateAudioSettings = throttle((settings) => {
	if (!electron?.ipcRenderer || !IPC_EVENTS?.UPDATE_AUDIO_SETTINGS) {
		console.warn("[index.vue] Electron veya IPC_EVENTS tanımlı değil");
		return;
	}
	try {
		electron.ipcRenderer.send(IPC_EVENTS.UPDATE_AUDIO_SETTINGS, settings);
	} catch (error) {
		console.error("[index.vue] Ses ayarları güncellenirken hata:", error);
	}
}, 1000);

// Mikrofon değişikliğini izle
watch(selectedAudioDevice, async (newDeviceId, oldDeviceId) => {
	if (newDeviceId && newDeviceId !== oldDeviceId) {
		try {
			// Mikrofon değişikliğini main process'e bildir
			if (electron?.ipcRenderer) {
				electron.ipcRenderer.send(IPC_EVENTS.AUDIO_DEVICE_CHANGED, newDeviceId);
			}

			// Eski yöntem - MediaState'e yeni mikrofon cihazını bildir
			throttledUpdateAudioSettings({
				selectedAudioDevice: newDeviceId,
			});

			// Ses analizini yeniden başlat
			await initAudioAnalyser();
		} catch (error) {
			console.error("[index.vue] Mikrofon değiştirme hatası:", error);
		}
	}
});

// Kamera değişikliği izleyicisi
watch(selectedVideoDevice, async (deviceId) => {
	if (deviceId) {
		try {
			// "Do not record camera" seçilirse kamera penceresini gizle
			if (deviceId === "none") {
				console.log(
					"[index.vue] No camera recording selected - hiding camera window"
				);
				if (electron?.ipcRenderer) {
					electron.ipcRenderer.send("HIDE_CAMERA_WINDOW");
				}
				return;
			}

			// Kamera değişikliğini main process'e bildir
			if (electron?.ipcRenderer) {
				// Önce kamera penceresini göster (gizlenmişse)
				electron.ipcRenderer.send("SHOW_CAMERA_WINDOW");
				// Sonra device değişikliğini gönder
				electron.ipcRenderer.send(IPC_EVENTS.CAMERA_DEVICE_CHANGED, deviceId);
			} else {
				console.error("[index.vue] Electron API bulunamadı");
			}
		} catch (error) {
			console.error("[index.vue] Kamera değişikliği sırasında hata:", error);
		}
	}
});

// Sürükleme durumu için ref
const isDragging = ref(false);
const initialMousePosition = ref({ x: 0, y: 0 });

// Pencere sürükleme fonksiyonları
const startDrag = (event) => {
	isDragging.value = true;
	initialMousePosition.value = {
		x: event.screenX,
		y: event.screenY,
	};

	// Global event listener'ları ekle
	window.addEventListener("mousemove", handleGlobalMouseMove);
	window.addEventListener("mouseup", handleGlobalMouseUp);

	electron?.ipcRenderer.send("START_WINDOW_DRAG", {
		x: event.screenX,
		y: event.screenY,
	});
};

const handleGlobalMouseMove = (event) => {
	if (!isDragging.value) return;

	electron?.ipcRenderer.send("WINDOW_DRAGGING", {
		x: event.screenX,
		y: event.screenY,
	});
};

const handleGlobalMouseUp = () => {
	if (!isDragging.value) return;

	isDragging.value = false;
	// Global event listener'ları kaldır
	window.removeEventListener("mousemove", handleGlobalMouseMove);
	window.removeEventListener("mouseup", handleGlobalMouseUp);

	electron?.ipcRenderer.send("END_WINDOW_DRAG");
};

const openRecordingSettings = () => {
	if (electron?.ipcRenderer) {
		electron.ipcRenderer.send("SHOW_RECORDING_SETTINGS");
	}
};

const handleSettingsSave = (settings) => {
	console.log("[index.vue] Recording settings saved:", settings);
	// TODO: Save settings to localStorage or electron-store
	// TODO: Apply settings to recording configuration

	// Example of applying some settings:
	if (settings.video) {
		console.log("Applying video settings:", settings.video);
	}
	if (settings.audio) {
		console.log("Applying audio settings:", settings.audio);
	}
	if (settings.source) {
		console.log("Applying source settings:", settings.source);
	}
};

onMounted(async () => {
	const screenModule = useScreen();

	// Cihazları yükle
	await getDevices();

	// Load available recording sources
	await loadAvailableSources();

	// MacRecorder test fonksiyonu
	if (electron?.ipcRenderer) {
		try {
			const [screens, windows] = await Promise.all([
				electron.macRecorder.getDisplays(),
				electron.macRecorder.getWindows(),
			]);
		} catch (testError) {
			console.error("[index.vue] MacRecorder API test hatası:", testError);
		}
	}

	// ✅ KESIN ÇÖZÜM: Direkt Display 1 seç

	const defaultSource = {
		sourceType: "display",
		sourceId: "screen:0",
		sourceName: "Display 1",
		macRecorderId: 0,
	};

	// IPC ile kaynak seçimini bildir
	if (electron?.ipcRenderer) {
		electron.ipcRenderer.send("UPDATE_RECORDING_SOURCE", defaultSource);
	}

	// Electron API'si yüklendiyse event listener'ları ekle
	if (electron) {
		// Mouse pozisyonlarını dinle
		electron.ipcRenderer.on("MOUSE_POSITION", (event, position) => {
			// Mouse pozisyonları useMediaDevices composable'ında işleniyor
		});

		// MediaState'i al ve ses durumlarını güncelle
		const mediaState = await electron.ipcRenderer.invoke(
			IPC_EVENTS.GET_MEDIA_STATE
		);
		if (mediaState?.audioSettings) {
			microphoneEnabled.value = mediaState.audioSettings.microphoneEnabled;
			systemAudioEnabled.value = mediaState.audioSettings.systemAudioEnabled;
			if (mediaState.audioSettings.selectedAudioDevice) {
				selectedAudioDevice.value =
					mediaState.audioSettings.selectedAudioDevice;
			}
		}

		// MediaState güncellemelerini dinle
		electron.ipcRenderer.on(IPC_EVENTS.MEDIA_STATE_UPDATE, (state) => {
			if (state?.audioSettings) {
				microphoneEnabled.value = state.audioSettings.microphoneEnabled;
				systemAudioEnabled.value = state.audioSettings.systemAudioEnabled;
				if (state.audioSettings.selectedAudioDevice) {
					selectedAudioDevice.value = state.audioSettings.selectedAudioDevice;
				}
			}
		});

		// Tray'den kayıt kontrolü için event listener'lar
		electron.ipcRenderer.on("START_RECORDING_FROM_TRAY", () => {
			startRecording({
				systemAudio: systemAudioEnabled.value,
				microphone: microphoneEnabled.value,
				microphoneDeviceId: selectedAudioDevice.value,
			});
		});

		electron.ipcRenderer.on("STOP_RECORDING_FROM_TRAY", () => {
			stopRecording();
		});

		// Kamera durumunu dinle
		electron.ipcRenderer.on("CAMERA_STATUS_CHANGED", (event, statusData) => {
			if (statusData.status === "active") {
			} else if (statusData.status === "error") {
				console.error("Kamera hatası:", statusData.error);
			}
		});

		// Native overlay callbacks
		electron.ipcRenderer.on(
			"NATIVE_SCREEN_SELECTED",
			async (event, screenData) => {
				try {
					// Set selected screen and start recording
					await electron.ipcRenderer.invoke("UPDATE_RECORDING_SOURCE", {
						sourceType: "display",
						sourceId: screenData.id,
						sourceName: screenData.name,
						macRecorderId: screenData.macRecorderId || 0,
					});

					// Start recording
					await startRecording({
						startScreen: true,
						startCamera: selectedVideoDevice.value !== "none",
						startAudio: true,
					});
				} catch (error) {
					console.error("Error starting screen recording:", error);
				}
			}
		);

		electron.ipcRenderer.on(
			"NATIVE_WINDOW_SELECTED",
			async (event, windowData) => {
				try {
					// Set selected window and start recording
					await electron.ipcRenderer.invoke("UPDATE_RECORDING_SOURCE", {
						sourceType: "window",
						sourceId: windowData.id,
						sourceName: windowData.name,
						macRecorderId: windowData.macRecorderId || 0,
					});

					// Start recording
					await startRecording({
						startScreen: true,
						startCamera: selectedVideoDevice.value !== "none",
						startAudio: true,
					});
				} catch (error) {
					console.error("Error starting window recording:", error);
				}
			}
		);

		electron.ipcRenderer.on("NATIVE_AREA_SELECTED", async (event, areaData) => {
			try {
				// Set selected area and start recording
				await electron.ipcRenderer.invoke("UPDATE_RECORDING_SOURCE", {
					sourceType: "area",
					sourceId: "area:custom",
					sourceName: "Selected Area",
					bounds: areaData.bounds,
				});

				// Start recording
				await startRecording({
					startScreen: true,
					startCamera: selectedVideoDevice.value !== "none",
					startAudio: true,
				});
			} catch (error) {
				console.error("Error starting area recording:", error);
			}
		});

		// Yeni kayıt için sıfırlama
		electron.ipcRenderer.send("RESET_FOR_NEW_RECORDING");
	}

	await initAudioAnalyser();

	// Kayıtlı delay değerini al
	if (electron?.ipcRenderer) {
		const delay = await electron.ipcRenderer.invoke(
			IPC_EVENTS.GET_RECORDING_DELAY
		);
		if (delay) {
			selectedDelay.value = delay;
		}
	}
});

// Kayıt durumu değiştiğinde tray'i güncelle
watch(isRecording, (newValue) => {
	if (electron?.ipcRenderer) {
		electron.ipcRenderer.send(IPC_EVENTS.RECORDING_STATUS_CHANGED, newValue);
	}
});

// Temizlik işlemleri
onBeforeUnmount(() => {
	// Event listener'ları temizle
	if (electron) {
		electron.ipcRenderer.removeAllListeners("AREA_SELECTED");
		electron.ipcRenderer.removeAllListeners("START_RECORDING_FROM_TRAY");
		electron.ipcRenderer.removeAllListeners("STOP_RECORDING_FROM_TRAY");
		electron.ipcRenderer.removeAllListeners("CAMERA_STATUS_CHANGED");
		electron.ipcRenderer.removeAllListeners("MOUSE_POSITION");
		electron.ipcRenderer.removeAllListeners("NATIVE_SCREEN_SELECTED");
		electron.ipcRenderer.removeAllListeners("NATIVE_WINDOW_SELECTED");
		electron.ipcRenderer.removeAllListeners("NATIVE_AREA_SELECTED");
	}
});

onUnmounted(() => {
	window.removeEventListener("mousemove", handleGlobalMouseMove);
	window.removeEventListener("mouseup", handleGlobalMouseUp);
	cleanupAudioAnalyser();
});
</script>

<style>
.camera-preview {
	pointer-events: none;
}

/* Geri sayım animasyonu */
@keyframes countdown {
	from {
		transform: scale(1.2);
		opacity: 0;
	}
	to {
		transform: scale(1);
		opacity: 1;
	}
}

.countdown-number {
	animation: countdown 0.5s ease-out;
}
</style>
