import os

def clean_literal_escapes():
    print("🧹 Iniciando higienização do ecossistema AR10 Orion...")
    targets = ["config", "src"]
    extensions = (".py", ".toml", ".json", ".env")
    fixed_count = 0

    # Varre as pastas de código
    for target in targets:
        if not os.path.exists(target):
            continue
        for root, _, files in os.walk(target):
            for file in files:
                if file.endswith(extensions):
                    filepath = os.path.join(root, file)
                    with open(filepath, "r", encoding="utf-8") as f:
                        content = f.read()
                    
                    # Se o arquivo termina com o texto literal \n (dois caracteres físicos)
                    if content.endswith("\\n"):
                        cleaned_content = content[:-2] + "\n"
                        with open(filepath, "w", encoding="utf-8") as f:
                            f.write(cleaned_content)
                        print(f"✅ Ajustado: {filepath}")
                        fixed_count += 1

    # Varre arquivos python na raiz do projeto (como run_organism.py)
    for file in os.listdir("."):
        if file.endswith(".py") and file!= "fix_all_files.py":
            with open(file, "r", encoding="utf-8") as f:
                content = f.read()
            if content.endswith("\\n"):
                cleaned_content = content[:-2] + "\n"
                with open(file, "w", encoding="utf-8") as f:
                    f.write(cleaned_content)
                print(f"✅ Ajustado raiz: {file}")
                fixed_count += 1

    print(f"\n🚀 Pronto! {fixed_count} arquivos foram higienizados e estão prontos para execução de produção.")

if __name__ == "__main__":
    clean_literal_escapes()