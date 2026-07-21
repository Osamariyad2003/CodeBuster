from transformers import pipeline, AutoTokenizer, AutoModelForSequenceClassification, Trainer, TrainingArguments
from datasets import load_dataset, Dataset
import torch
import requests
import os

class AICodeReviewer:
    def __init__(self, model_path=None):
        self.model_name = model_path or "microsoft/codebert-base"
        self.tokenizer = AutoTokenizer.from_pretrained(self.model_name)
        self.model = AutoModelForSequenceClassification.from_pretrained(self.model_name, num_labels=2)  # 0: clean, 1: buggy
        self.classifier = pipeline("text-classification", model=self.model, tokenizer=self.tokenizer)

    def train_on_dataset(self, dataset_name="code_x_glue_cc_code_to_code_trans", epochs=3):
        """Fine-tune the model on a dataset."""
        # Load dataset
        dataset = load_dataset(dataset_name, split="train[:10%]")  # Use subset for demo
        
        # Preprocess: Assume dataset has 'code' and 'label' columns
        def tokenize_function(examples):
            return self.tokenizer(examples["code"], truncation=True, padding="max_length", max_length=512)
        
        tokenized_dataset = dataset.map(tokenize_function, batched=True)
        tokenized_dataset = tokenized_dataset.rename_column("label", "labels")
        tokenized_dataset.set_format("torch", columns=["input_ids", "attention_mask", "labels"])
        
        # Training arguments
        training_args = TrainingArguments(
            output_dir="./results",
            num_train_epochs=epochs,
            per_device_train_batch_size=8,
            per_device_eval_batch_size=8,
            warmup_steps=500,
            weight_decay=0.01,
            logging_dir="./logs",
            logging_steps=10,
            save_steps=500,
            evaluation_strategy="steps",
            eval_steps=500,
        )
        
        # Trainer
        trainer = Trainer(
            model=self.model,
            args=training_args,
            train_dataset=tokenized_dataset,
            eval_dataset=tokenized_dataset,  # Use same for demo
        )
        
        trainer.train()
        self.model.save_pretrained("./fine_tuned_model")
        self.tokenizer.save_pretrained("./fine_tuned_model")
        print("Model fine-tuned and saved.")

    def review_pr(self, pr_diff: str) -> list:
        """Analyze PR diff and return review comments."""
        issues = []
        # Basic diff parsing: Split by @@ for hunks
        hunks = pr_diff.split('\n@@')
        for hunk in hunks:
            lines = hunk.split('\n')
            for i, line in enumerate(lines):
                if line.startswith('+') and len(line) > 1:  # Added lines
                    snippet = line[1:].strip()
                    if snippet:
                        result = self.classifier(snippet)
                        if result[0]['label'] == 'LABEL_1' and result[0]['score'] > 0.7:  # Threshold for buggy
                            issues.append({
                                "file": "unknown",  # Parse from diff header
                                "line": i,  # Approximate
                                "comment": f"Potential code issue: {result[0]['label']} (confidence: {result[0]['score']:.2f})"
                            })
        return issues

    def post_review_to_github(self, repo_full_name: str, pr_number: int, issues: list, access_token: str):
        """Post comments to GitHub PR."""
        for issue in issues:
            url = f"https://api.github.com/repos/{repo_full_name}/pulls/{pr_number}/comments"
            data = {
                "body": issue["comment"],
                "commit_id": payload.get('pull_request', {}).get('head', {}).get('sha'),  # From webhook payload
                "path": issue["file"],
                "line": issue["line"]
            }
            response = requests.post(url, json=data, headers={"Authorization": f"token {access_token}"})
            if response.status_code != 201:
                print(f"Failed to post comment: {response.text}")

# To train: reviewer = AICodeReviewer(); reviewer.train_on_dataset()