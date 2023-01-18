import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import fetch from "node-fetch";


// Remember to rename these classes and interfaces!
interface  PluginSettings {
	apiKey: string;
	organisationId: string;
	defaultMaxTokenLength: number;
}

const DEFAULT_SETTINGS: PluginSettings = {
	apiKey: '',
	organisationId: '',
	defaultMaxTokenLength: 50,
}

export default class Gtp extends Plugin {
	settings: PluginSettings;

	async onload() {
		await this.loadSettings();

		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'gtp',
			name: 'Run ChatGTP',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				const onResponse = (response:string) => {editor.replaceSelection(response)};
				new DialogModal(this.app, onResponse,this.settings).open();
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SettingTab(this.app, this));
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

// set return type to string
class DialogModal extends Modal{

	onResponse: (response:any)  => any;
	settings: PluginSettings;
	maxTokens:number;

	constructor(
		app: App,
		onResponse: (response:any) => any,
		settings: PluginSettings
	) {
		super(app);
		this.onResponse = onResponse;
		this.settings = settings;
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.createEl('h2', {text: 'Run ChatGTP'});

		// text input
		let inputPrompt = contentEl.createEl('textarea', {placeholder: 'Enter your GTP command here', cls: 'gtp_prompt_input'});
		/*inputPrompt.addEventListener('keydown', (evt) => {
			if (evt.key === 'Enter') {
				this.runCommand(inputPrompt.value).then((response:any) => {
					this.onResponse(response['choices'][0].text);
				});
			}
		});*/

		// button
		contentEl.createEl('button', {text: 'Run', cls: 'gtp_run_button'}).addEventListener('click', () => {
			this.runCommand(inputPrompt.value).then((response:any) => {
				this.onResponse(response['choices'][0].text);
			});
		});

	}

	async runCommand(command:string) {
		// show a notice that the command is running
		new Notice('Running command: ' + command);

		const response = await fetch("https://api.openai.com/v1/completions", {
			method: 'POST',
			headers: {
				"Content-Type": "application/json",
				"OpenAI-Organization": this.settings.organisationId,
				"Authorization": "Bearer " + this.settings.apiKey
			},
			body: JSON.stringify({
				prompt: command + 'in markdown',
				model: "text-davinci-003",
				"temperature": 0,
				"max_tokens": Number(this.settings.defaultMaxTokenLength),
			}),
		} );

		// TODO error handling
		if (!response.ok) {
			return new Notice('error:  ' + response.statusText);
		}

		// close the modal
		this.close();
		return response.json();
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class SettingTab extends PluginSettingTab {
	plugin: Gtp;

	constructor(app: App, plugin: Gtp) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Open AI Credentials'});

		new Setting(containerEl)
			.setName('Open AI API key')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your API key')
				.setValue(this.plugin.settings.apiKey)
				.onChange(async (value) => {
					this.plugin.settings.apiKey = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Organisation ID')
			.setDesc('It\'s a secret too')
			.addText(text => text
				.setPlaceholder('Enter your Organisation id')
				.setValue(this.plugin.settings.organisationId)
				.onChange(async (value) => {
					this.plugin.settings.organisationId = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Max Tokens')
			.setDesc('This will be the max number of tokens returned by the API')
			.addText(text => text
				.setPlaceholder('Enter your max tokens')
				.setValue(String(this.plugin.settings.defaultMaxTokenLength))
				.onChange(async (value) => {
					this.plugin.settings.defaultMaxTokenLength = Number(value);
					await this.plugin.saveSettings();
				}));
	}
}
